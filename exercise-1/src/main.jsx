import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './styles.css';

const queryClient = new QueryClient();

async function getProducts(searchTerm) {
  let url = 'https://dummyjson.com/products';

  if (searchTerm) {
    url += `/search?q=${encodeURIComponent(searchTerm)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Could not load products.');
  }

  const data = await response.json();
  return data.products;
}

function ProductList() {
  const [search, setSearch] = useState('');

  const {
    data: products,
    error,
    isError,
    isFetching,
    isPending,
    isSuccess,
    refetch,
  } = useQuery({
    queryKey: ['products', { search }],
    queryFn: () => getProducts(search),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return (
    <main className="container">
      <h1>Exercise 1: Products</h1>
      <p>Search for products and refresh the list.</p>

      <label>
        Search products:
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="For example, phone"
        />
      </label>

      <button onClick={() => refetch()}>Refresh products</button>

      {isPending && <p>Loading products...</p>}
      {isFetching && !isPending && <p>Updating products...</p>}
      {isError && <p className="error">{error.message}</p>}

      {isSuccess && (
        <>
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            <ul className="product-list">
              {products.map((product) => (
                <li key={product.id}>
                  <img src={product.thumbnail} alt="" />
                  <div>
                    <h2>{product.title}</h2>
                    <p>{product.description}</p>
                    <p>${product.price}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductList />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
