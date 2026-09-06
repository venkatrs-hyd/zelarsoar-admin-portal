import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout, Skeleton } from '@/components';
import Placeholder from '@/pages/Placeholder';
import ComingSoon from '@/pages/ComingSoon';
import NotFound from '@/pages/NotFound';

// Route-level code splitting (design.md §8). Page agents replace the
// Placeholder stubs by creating real page files and swapping the element.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Incidents = lazy(() => import('@/pages/Incidents'));
const SoarPolicies = lazy(() => import('@/pages/SoarPolicies'));
const Tenants = lazy(() => import('@/pages/Tenants'));
const UsersRoles = lazy(() => import('@/pages/UsersRoles'));
const Licensing = lazy(() => import('@/pages/Licensing'));
const States = lazy(() => import('@/pages/States'));

function lazyPage(el: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{el}</Suspense>;
}

function PageFallback() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-5 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="alerts" element={lazyPage(<Alerts />)} />
        <Route path="incidents" element={lazyPage(<Incidents />)} />
        <Route path="soar-policies" element={lazyPage(<SoarPolicies />)} />
        <Route path="tenants" element={lazyPage(<Tenants />)} />
        <Route path="users-roles" element={lazyPage(<UsersRoles />)} />
        <Route path="licensing" element={lazyPage(<Licensing />)} />
        <Route path="states" element={lazyPage(<States />)} />
        <Route path="design-system" element={<Placeholder />} />
        <Route path="threat-map" element={<ComingSoon />} />
        <Route path="audit-log" element={<ComingSoon />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
