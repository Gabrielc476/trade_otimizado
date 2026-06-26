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

  public async register(name: string, passwordHash: string): Promise<any> {
    const pgClient = this.engineService.getPgClient();
    const pool = pgClient.getPool();
    const client = await pool.connect();

    try {
      // 1. Hash password and insert user returning the generated SERIAL id
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(passwordHash, salt);

      const insertRes = await client.query(
        'INSERT INTO users (name, password_hash) VALUES ($1, $2) RETURNING id',
        [name, hashedPassword]
      );
      const id = insertRes.rows[0].id;

      console.log(`User ${name} (#${id}) registered. Crediting initial balances...`);

      // 2. Credit initial balances ($100,000 USD and 10 BTC)
      const outboxPoller = this.engineService.getOutboxPoller();
      const initialUsd = 100000n * this.scale;
      const initialBtc = 10n * this.scale;

      await outboxPoller.createDepositOrWithdrawal(id, 'USDT', initialUsd, 'DEPOSIT');
      await outboxPoller.createDepositOrWithdrawal(id, 'BTC', initialBtc, 'DEPOSIT');

      return { success: true, userId: id, name };
    } catch (err) {
      console.error('Error in register:', err);
      throw new ConflictException('Failed to register user');
    } finally {
      client.release();
    }
  }

  public async login(id: number, passwordHash: string): Promise<any> {
    const pgClient = this.engineService.getPgClient();
    const pool = pgClient.getPool();
    const res = await pool.query('SELECT id, name, password_hash FROM users WHERE id = $1', [id]);

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = res.rows[0];
    const isPasswordValid = await bcrypt.compare(passwordHash, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user.id, username: user.name };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
      },
    };
  }
}
