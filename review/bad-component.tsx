import React, { useEffect, useState } from 'react';

/**
 * ProductSearchPanel — as submitted for review.
 *
 * Renders a searchable, sortable product list with a running cart summary.
 * It works in the demo, which is why it got this far.
 */

type Product = {
  id: number;
  title: string;
  price: number;
  category: string;
  rating: { rate: number; count: number };
};

type CartLine = { product: Product; quantity: number };

type Props = {
  cart: CartLine[];
  onAddToCart: (product: Product) => void;
};

export function ProductSearchPanel({ cart, onAddToCart }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('price-asc');
  const [loading, setLoading] = useState(true);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`https://fakestoreapi.com/products?search=${search}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      });
  }, [search, products]);

  useEffect(() => {
    let total = 0;
    let count = 0;
    cart.forEach((line) => {
      total = total + line.product.price * line.quantity;
      count = count + line.quantity;
    });
    setCartTotal(total);
    setCartCount(count);
  }, [cart]);

  const visible = products
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (sort === 'price-asc' ? a.price - b.price : b.price - a.price));

  return (
    <div>
      <input
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>

      <div>
        {cartCount} items — ${cartTotal.toFixed(2)}
      </div>

      {loading && <div>Loading...</div>}

      {visible.map((product, i) => (
        <div key={i} className="card">
          <h3 dangerouslySetInnerHTML={{ __html: product.title }} />
          <p>{product.category}</p>
          <p>${product.price}</p>
          <button onClick={() => onAddToCart(product)}>Add to cart</button>
        </div>
      ))}
    </div>
  );
}
