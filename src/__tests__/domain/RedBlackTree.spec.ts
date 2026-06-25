import { RedBlackTree, NodeColor } from '../../domain/entities/RedBlackTree';

describe('RedBlackTree', () => {
  let tree: RedBlackTree;

  beforeEach(() => {
    tree = new RedBlackTree();
  });

  it('should be empty initially', () => {
    expect(tree.isEmpty()).toBe(true);
    expect(tree.getMinNode()).toBeNull();
    expect(tree.getMaxNode()).toBeNull();
  });

  it('should insert and find price levels correctly', () => {
    const list100 = tree.insert(100n);
    expect(tree.isEmpty()).toBe(false);
    expect(list100).toBeDefined();

    const list100_again = tree.insert(100n);
    expect(list100_again).toBe(list100);

    const found = tree.find(100n);
    expect(found).toBe(list100);

    const notFound = tree.find(200n);
    expect(notFound).toBeNull();
  });

  it('should maintain ordering of min and max elements', () => {
    tree.insert(150n);
    tree.insert(100n);
    tree.insert(200n);
    tree.insert(50n);
    tree.insert(250n);

    expect(tree.getMinNode()?.price).toBe(50n);
    expect(tree.getMaxNode()?.price).toBe(250n);
  });

  it('should balance itself following Red-Black properties on insertion', () => {
    // Left-leaning insertions to force rotations and recoloring
    tree.insert(50n);
    tree.insert(40n);
    tree.insert(30n);

    // Root must be BLACK
    expect(tree.getRoot().color).toBe(NodeColor.BLACK);
    // Root should be the middle node (40n) after right rotation
    expect(tree.getRoot().price).toBe(40n);
    expect(tree.getRoot().left?.price).toBe(30n);
    expect(tree.getRoot().right?.price).toBe(50n);
    expect(tree.getRoot().left?.color).toBe(NodeColor.RED);
    expect(tree.getRoot().right?.color).toBe(NodeColor.RED);
  });

  it('should delete nodes correctly and maintain balance', () => {
    tree.insert(10n);
    tree.insert(20n);
    tree.insert(30n);
    tree.insert(15n);

    // Delete leaf node
    tree.delete(30n);
    expect(tree.find(30n)).toBeNull();

    // Delete node with two children
    tree.delete(20n);
    expect(tree.find(20n)).toBeNull();

    // Ensure remaining nodes are still searchable
    expect(tree.find(10n)).not.toBeNull();
    expect(tree.find(15n)).not.toBeNull();
  });

  it('should gracefully handle deletion of non-existent keys', () => {
    tree.insert(10n);
    // Should not throw or crash
    expect(() => tree.delete(99n)).not.toThrow();
  });

  it('should pass intensive stress testing with various insertion and deletion orders to trigger balancing branches', () => {
    const prices = [50n, 25n, 75n, 12n, 37n, 62n, 87n, 6n, 18n, 31n, 43n, 56n, 68n, 81n, 93n];
    
    // Insert all
    for (const p of prices) {
      tree.insert(p);
    }
    
    // Verify all exist
    for (const p of prices) {
      expect(tree.find(p)).not.toBeNull();
    }

    // Delete in reverse order of insertion to trigger complex recolorings and rotations
    for (let i = prices.length - 1; i >= 0; i--) {
      tree.delete(prices[i]);
      expect(tree.find(prices[i])).toBeNull();
    }

    expect(tree.isEmpty()).toBe(true);

    // Another sequence: sequential insertion to trigger heavy one-sided rotations
    const seqPrices = [10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n, 90n, 100n];
    for (const p of seqPrices) {
      tree.insert(p);
    }

    // Delete sequentially
    for (const p of seqPrices) {
      tree.delete(p);
      expect(tree.find(p)).toBeNull();
    }
    expect(tree.isEmpty()).toBe(true);
  });
});
