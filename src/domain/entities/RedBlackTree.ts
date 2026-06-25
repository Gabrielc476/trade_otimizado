import { DoublyLinkedList } from './DoublyLinkedList';

export enum NodeColor {
  RED = 0,
  BLACK = 1,
}

export class RBNode {
  public price: bigint;
  public list: DoublyLinkedList;
  public color: NodeColor;
  public left: RBNode;
  public right: RBNode;
  public parent: RBNode;

  constructor(price: bigint, nil?: RBNode) {
    this.price = price;
    this.list = new DoublyLinkedList();
    this.color = NodeColor.RED;
    // Para o nó NIL, os ponteiros apontam para ele mesmo. Para os outros, apontam para o NIL.
    this.left = nil || this;
    this.right = nil || this;
    this.parent = nil || this;
  }
}

export class RedBlackTree {
  private root: RBNode;
  private NIL: RBNode;

  constructor() {
    this.NIL = new RBNode(0n);
    this.NIL.color = NodeColor.BLACK;
    this.root = this.NIL;
  }

  public getRoot(): RBNode {
    return this.root;
  }

  public getNIL(): RBNode {
    return this.NIL;
  }

  public find(price: bigint): DoublyLinkedList | null {
    let current = this.root;
    while (current !== this.NIL) {
      if (price === current.price) {
        return current.list;
      } else if (price < current.price) {
        current = current.left;
      } else {
        current = current.right;
      }
    }
    return null;
  }

  public insert(price: bigint): DoublyLinkedList {
    const existing = this.find(price);
    if (existing !== null) {
      return existing;
    }

    const node = new RBNode(price, this.NIL);
    let y = this.NIL;
    let x = this.root;

    while (x !== this.NIL) {
      y = x;
      if (node.price < x.price) {
        x = x.left;
      } else {
        x = x.right;
      }
    }

    node.parent = y;
    if (y === this.NIL) {
      this.root = node;
    } else if (node.price < y.price) {
      y.left = node;
    } else {
      y.right = node;
    }

    node.color = NodeColor.RED;
    this.insertFixup(node);
    return node.list;
  }

  public delete(price: bigint): void {
    let z = this.root;
    while (z !== this.NIL) {
      if (price === z.price) {
        break;
      } else if (price < z.price) {
        z = z.left;
      } else {
        z = z.right;
      }
    }

    if (z === this.NIL) {
      return;
    }

    let y = z;
    let yOriginalColor = y.color;
    let x: RBNode;

    if (z.left === this.NIL) {
      x = z.right;
      this.transplant(z, z.right);
    } else if (z.right === this.NIL) {
      x = z.left;
      this.transplant(z, z.left);
    } else {
      y = this.minimum(z.right);
      yOriginalColor = y.color;
      x = y.right;
      if (y.parent === z) {
        x.parent = y;
      } else {
        this.transplant(y, y.right);
        y.right = z.right;
        y.right.parent = y;
      }
      this.transplant(z, y);
      y.left = z.left;
      y.left.parent = y;
      y.color = z.color;
    }

    if (yOriginalColor === NodeColor.BLACK) {
      this.deleteFixup(x);
    }
  }

  public getMinNode(): RBNode | null {
    if (this.root === this.NIL) return null;
    return this.minimum(this.root);
  }

  public getMaxNode(): RBNode | null {
    if (this.root === this.NIL) return null;
    return this.maximum(this.root);
  }

  public isEmpty(): boolean {
    return this.root === this.NIL;
  }

  private minimum(node: RBNode): RBNode {
    while (node.left !== this.NIL) {
      node = node.left;
    }
    return node;
  }

  private maximum(node: RBNode): RBNode {
    while (node.right !== this.NIL) {
      node = node.right;
    }
    return node;
  }

  private leftRotate(x: RBNode): void {
    const y = x.right;
    x.right = y.left;
    if (y.left !== this.NIL) {
      y.left.parent = x;
    }
    y.parent = x.parent;
    if (x.parent === this.NIL) {
      this.root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }
    y.left = x;
    x.parent = y;
  }

  private rightRotate(y: RBNode): void {
    const x = y.left;
    y.left = x.right;
    if (x.right !== this.NIL) {
      x.right.parent = y;
    }
    x.parent = y.parent;
    if (y.parent === this.NIL) {
      this.root = x;
    } else if (y === y.parent.right) {
      y.parent.right = x;
    } else {
      y.parent.left = x;
    }
    x.right = y;
    y.parent = x;
  }

  private insertFixup(k: RBNode): void {
    let u: RBNode;
    while (k.parent.color === NodeColor.RED) {
      if (k.parent === k.parent.parent.left) {
        u = k.parent.parent.right;
        if (u.color === NodeColor.RED) {
          u.color = NodeColor.BLACK;
          k.parent.color = NodeColor.BLACK;
          k.parent.parent.color = NodeColor.RED;
          k = k.parent.parent;
        } else {
          if (k === k.parent.right) {
            k = k.parent;
            this.leftRotate(k);
          }
          k.parent.color = NodeColor.BLACK;
          k.parent.parent.color = NodeColor.RED;
          this.rightRotate(k.parent.parent);
        }
      } else {
        u = k.parent.parent.left;
        if (u.color === NodeColor.RED) {
          u.color = NodeColor.BLACK;
          k.parent.color = NodeColor.BLACK;
          k.parent.parent.color = NodeColor.RED;
          k = k.parent.parent;
        } else {
          if (k === k.parent.left) {
            k = k.parent;
            this.rightRotate(k);
          }
          k.parent.color = NodeColor.BLACK;
          k.parent.parent.color = NodeColor.RED;
          this.leftRotate(k.parent.parent);
        }
      }
      if (k === this.root) {
        break;
      }
    }
    this.root.color = NodeColor.BLACK;
  }

  private transplant(u: RBNode, v: RBNode): void {
    if (u.parent === this.NIL) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }
    v.parent = u.parent;
  }

  private deleteFixup(x: RBNode): void {
    let s: RBNode;
    while (x !== this.root && x.color === NodeColor.BLACK) {
      if (x === x.parent.left) {
        s = x.parent.right;
        if (s.color === NodeColor.RED) {
          s.color = NodeColor.BLACK;
          x.parent.color = NodeColor.RED;
          this.leftRotate(x.parent);
          s = x.parent.right;
        }

        if (s.left.color === NodeColor.BLACK && s.right.color === NodeColor.BLACK) {
          s.color = NodeColor.RED;
          x = x.parent;
        } else {
          if (s.right.color === NodeColor.BLACK) {
            s.left.color = NodeColor.BLACK;
            s.color = NodeColor.RED;
            this.rightRotate(s);
            s = x.parent.right;
          }

          s.color = x.parent.color;
          x.parent.color = NodeColor.BLACK;
          s.right.color = NodeColor.BLACK;
          this.leftRotate(x.parent);
          x = this.root;
        }
      } else {
        s = x.parent.left;
        if (s.color === NodeColor.RED) {
          s.color = NodeColor.BLACK;
          x.parent.color = NodeColor.RED;
          this.rightRotate(x.parent);
          s = x.parent.left;
        }

        if (s.right.color === NodeColor.BLACK && s.left.color === NodeColor.BLACK) {
          s.color = NodeColor.RED;
          x = x.parent;
        } else {
          if (s.left.color === NodeColor.BLACK) {
            s.right.color = NodeColor.BLACK;
            s.color = NodeColor.RED;
            this.leftRotate(s);
            s = x.parent.left;
          }

          s.color = x.parent.color;
          x.parent.color = NodeColor.BLACK;
          s.left.color = NodeColor.BLACK;
          this.rightRotate(x.parent);
          x = this.root;
        }
      }
    }
    x.color = NodeColor.BLACK;
  }
}
