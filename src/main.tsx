import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/graphql/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <ApolloProvider client={apolloClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ApolloProvider>,
);
