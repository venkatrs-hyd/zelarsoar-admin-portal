/**
 * ApolloClient for the ZelarSOAR Admin Portal (design.md §4).
 * - relayStylePagination for every connection field: keyArgs on filters,
 *   merge edges/pageInfo so `fetchMore` + "Load more" just works.
 * - errorPolicy 'all' by default: partial data renders alongside PartialBanner.
 * - Devtools disabled (production build).
 */
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { relayStylePagination } from '@apollo/client/utilities';
import { GatewayLink } from './GatewayLink';

export const apolloClient = new ApolloClient({
  link: new GatewayLink(),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          alerts: relayStylePagination(['filter']),
          tenants: relayStylePagination(['filter']),
          users: relayStylePagination(['tenantId', 'role']),
          incidents: relayStylePagination(['filter']),
          blockedIps: relayStylePagination(['tenantId']),
          auditLog: relayStylePagination(['filter']),
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
    mutate: { errorPolicy: 'all' },
  },
  devtools: { enabled: false },
});
