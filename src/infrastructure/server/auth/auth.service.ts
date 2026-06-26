import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EngineService } from '../engine.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly scale = 100000000n; // 10^8

  constructor(
    private readonly engineService: EngineService,
    private readonly jwtService: JwtService,
  ) {}

  public async register(emailOrId: string | number, name: string, passwordHash: string): Promise<any> {
    const pgClient = this.engineService.getPgClient();
    const pool = pgClient.getPool();
    const client = await pool.connect();

    try {
      let email: string;
      let explicitId: number | null = null;

      if (typeof emailOrId === 'number' || (!isNaN(Number(emailOrId)) && !emailOrId.toString().includes('@'))) {
        // Old script registration using ID
        explicitId = Number(emailOrId);
        email = `user_${explicitId}@apextrade.com`;
      } else {
        // New email-based registration
        email = emailOrId.toString();
      }

      // 1. Check if email already exists
      const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        throw new ConflictException('Email already registered');
      }

      if (explicitId !== null) {
        // Check if ID already exists
        const existingId = await client.query('SELECT id FROM users WHERE id = $1', [explicitId]);
        if (existingId.rows.length > 0) {
          throw new ConflictException(`User with ID ${explicitId} already exists`);
        }
      }

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(passwordHash, salt);

      // 3. Insert user (handling explicit ID if provided)
      let id: number;
      if (explicitId !== null) {
        await client.query(
          'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
          [explicitId, email, name, hashedPassword]
        );
        id = explicitId;

        // Reset the SERIAL sequence to avoid future duplicate key errors
        await client.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 1), false)");
      } else {
        const insertRes = await client.query(
          'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [email, name, hashedPassword]
        );
        id = insertRes.rows[0].id;
      }

      console.log(`User ${name} (${email}) (#${id}) registered. Crediting initial balances...`);

      // 4. Credit initial balances ($100,000 USD and 10 BTC)
      const outboxPoller = this.engineService.getOutboxPoller();
      const initialUsd = 100000n * this.scale;
      const initialBtc = 10n * this.scale;

      await outboxPoller.createDepositOrWithdrawal(id, 'USDT', initialUsd, 'DEPOSIT');
      await outboxPoller.createDepositOrWithdrawal(id, 'BTC', initialBtc, 'DEPOSIT');

      return { success: true, userId: id, email, name };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      console.error('Error in register:', err);
      throw new ConflictException('Failed to register user');
    } finally {
      client.release();
    }
  }

  public async login(emailOrId: string | number, passwordHash: string): Promise<any> {
    const pgClient = this.engineService.getPgClient();
    const pool = pgClient.getPool();
    
    let res;
    if (typeof emailOrId === 'number' || (!isNaN(Number(emailOrId)) && !emailOrId.toString().includes('@'))) {
      // Login by ID (old script login)
      const id = Number(emailOrId);
      res = await pool.query('SELECT id, email, name, password_hash FROM users WHERE id = $1', [id]);
    } else {
      // Login by Email
      const email = emailOrId.toString();
      res = await pool.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]);
    }

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = res.rows[0];
    const isPasswordValid = await bcrypt.compare(passwordHash, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user.id, email: user.email, username: user.name };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
