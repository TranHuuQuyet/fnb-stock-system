# Frontend Architecture & Components

Updated: 2026-04-27

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS + PostCSS
- **State Management**: React Query (TanStack Query)
- **Form Handling**: React Hook Form with Zod validation
- **Database**: IndexedDB for offline storage
- **QR Scanning**: html5-qrcode
- **QR Generation**: qrcode.react
- **Utils**: date-fns for date handling, clsx for class names
- **Testing**: Vitest for unit tests

## Application Structure

```
frontend/
├── app/                           # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   ├── (protected)/              # Protected routes (require auth)
│   ├── admin/                    # Admin dashboard & management
│   ├── dashboard/                # User dashboard
│   ├── change-password/          # Password change flow
│   ├── ingredient-stock/         # Inventory stock board
│   ├── login/                    # Login page
│   ├── profile/                  # User profile
│   ├── scan/                     # QR scanning interface
│   ├── scan-logs/                # View scan history
│   ├── work-schedules/           # Work schedule management
│   └── layout.tsx                # Root layout
├── components/                    # Reusable React components
│   ├── admin/                    # Admin-specific components
│   ├── ingredient-stock/         # Stock board components
│   ├── layout/                   # Layout components (nav, sidebar)
│   ├── scan/                     # Scanning components
│   ├── ui/                       # Base UI components (buttons, forms, etc)
│   ├── work-schedules/           # Work schedule components
│   ├── providers.tsx             # App providers (React Query, etc)
│   └── pwa-bootstrap.tsx         # PWA initialization
├── hooks/                         # Custom React hooks
│   ├── use-network-status.ts     # Network connectivity detection
│   ├── use-offline-sync.ts       # Offline/online sync coordination
│   └── use-resolved-session.ts   # Session resolution logic
├── lib/                           # Utility functions
│   ├── api-client.ts             # HTTP client with interceptors
│   ├── auth.ts                   # Authentication utilities
│   ├── batch-qr.ts               # QR code handling
│   ├── indexeddb.ts              # IndexedDB operations
│   ├── localization.ts           # i18n support
│   ├── password-policy.ts        # Password validation
│   ├── pwa.ts                    # PWA utilities
│   └── zod-vi.ts                 # Vietnamese Zod translations
├── public/                        # Static assets
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker
├── services/                      # API service layer
│   ├── admin/                    # Admin APIs
│   ├── auth/                     # Authentication APIs
│   ├── batches/                  # Batch management APIs
│   ├── config/                   # Configuration APIs
│   ├── dashboard/                # Dashboard data APIs
│   ├── ingredient-stock-board/   # Stock board APIs
│   ├── pos/                      # POS integration APIs
│   ├── scan/                     # Scanning operations APIs
│   ├── stores/                   # Store management APIs
│   ├── transfers/                # Transfer operations APIs
│   └── work-schedules/           # Work schedule APIs
├── globals.css                    # Global styles
├── layout.tsx                     # Root layout configuration
└── page.tsx                       # Home page
```

## Page Structure

### Authentication Pages
- **`/login`**: Login form with remember-me functionality
- **`/change-password`**: Forced password change on first login
- **`/profile`**: User profile view and edit

### Admin Pages (`/admin/*`)
- **`/admin/users`**: User management (create, edit, lock/unlock)
- **`/admin/stores`**: Store/branch management
- **`/admin/ingredients`**: Ingredient master data management
- **`/admin/ingredients/units`**: Ingredient units management
- **`/admin/batches`**: Batch management with QR generation
- **`/admin/batches/:id/print-labels`**: Label printing interface
- **`/admin/reports`**: Admin reports dashboard
- **`/admin/pos-products`**: POS product management
- **`/admin/recipes`**: Recipe management
- **`/admin/network-whitelists`**: IP whitelist configuration
- **`/admin/network-bypasses`**: Emergency bypass management
- **`/admin/config`**: Application configuration

### Operations Pages
- **`/dashboard`**: User dashboard with summary cards
- **`/ingredient-stock`**: Stock board with daily/shift aggregation
- **`/scan`**: Main QR scanning interface
- **`/scan/transfer`**: Transfer scanning interface
- **`/scan-logs`**: View scan operation history
- **`/work-schedules`**: Work schedule management
- **`/transfers`**: View transfer tickets and confirmations

## Component Architecture

### UI Components (`components/ui/`)
Base, reusable components:
- `button`, `input`, `form`, `dialog`, `table`
- `card`, `badge`, `tabs`, `dropdown`
- `date-picker`, `select`, `checkbox`, `radio`
- `alert`, `toast`, `loading-spinner`

### Layout Components (`components/layout/`)
- `navbar`: Top navigation with user menu
- `sidebar`: Left sidebar with navigation
- `breadcrumb`: Navigation breadcrumb
- `page-header`: Standard page header with title

### Feature Components
- **Admin**: User list, user form, store form, ingredient form, batch form, recipe editor
- **Scan**: Camera interface, batch details card, scan result modal, offline queue status
- **Stock Board**: Monthly summary, daily/shift grid, filter panel, layout customizer
- **Work Schedules**: Monthly calendar, shift editor, employee rates, payroll display
- **Ingredient Stock**: Responsive card view for mobile, detailed grid for desktop

## Service Layer

Each service module provides typed API calls:

```typescript
// Example: batches service
export const getBatch = (id: string) => api.get(`/batches/${id}`)
export const createBatch = (data: CreateBatchDto) => api.post('/batches', data)
export const updateBatch = (id: string, data: UpdateBatchDto) => api.patch(`/batches/${id}`, data)
```

Services are organized by business domain and use a consistent naming convention.

## State Management Strategy

### React Query (Server State)
- Manages API responses and caching
- Automatic refetching and background updates
- Optimistic updates for offline operations

### IndexedDB (Client State)
- Offline queue storage for all operations
- Persistent user preferences (layout, filters)
- Temporary data during offline mode

### Component State (React)
- Form state managed by React Hook Form
- UI state (modals, dropdowns, pagination)
- Navigation state (current tab, filters)

## Offline-First Architecture

### Workflow
1. **Online**: Requests go directly to API, responses cached in IndexedDB
2. **Offline**: Requests queued in IndexedDB, UI shows pending status
3. **Reconnect**: Queue processed automatically, conflicts resolved
4. **Sync**: User sees operation confirmation once synced

### Implementation
- `useNetworkStatus()`: Detects network changes
- `useOfflineSync()`: Manages queue and sync operations
- Custom middleware in `api-client.ts`: Intercepts requests

## Form Validation

Uses Zod for schema validation with Vietnamese error messages:

```typescript
const createIngredientSchema = z.object({
  name: z.string().min(1, 'Tên nguyên liệu là bắt buộc'),
  unit: z.string().min(1, 'Đơn vị là bắt buộc'),
  group: z.string().min(1, 'Nhóm nguyên liệu là bắt buộc')
})
```

## Internationalization

Vietnamese language support via:
- `lib/localization.ts`: Locale-specific functions
- `lib/zod-vi.ts`: Vietnamese error messages
- Component messages stored in constants

## Performance Optimizations

- Code splitting with Next.js dynamic imports
- Image optimization with Next.js Image component
- CSS-in-JS with Tailwind (no runtime overhead)
- Lazy loading for routes and components
- Query client caching strategy
- IndexedDB indexing for fast local searches

## PWA Features

### Manifest (`public/manifest.json`)
- App name, icon, display mode
- Start URL, theme colors
- Installation settings

### Service Worker (`public/sw.js`)
- Offline page serving
- Background sync for queued operations
- Cache-first strategies for assets
- Network-first for API calls

### Bootstrap (`components/pwa-bootstrap.tsx`)
- Prompts for installation
- Handles update notifications
- Manages service worker lifecycle

## Testing Strategy

### Unit Tests (Vitest)
- Service layer functions
- Utility functions in `lib/`
- Custom hooks

### Component Tests
- Form submissions with Zod validation
- Offline queue behavior
- Network status changes

Test files use `.test.ts` pattern for easy discovery.

## Build Configuration

### `next.config.js`
- Production optimizations
- PWA plugin configuration
- Environment variable handling

### `tsconfig.json`
- TypeScript strict mode
- Path aliases (`@/*`)
- JSX preset

### `tailwind.config.ts`
- Custom theme configuration
- Vietnamese typography
- Responsive breakpoints

## Security Considerations

- CSRF protection via secure cookies
- XSS prevention through React's default escaping
- Input validation on all forms
- Secure API client with interceptors
- No sensitive data in localStorage (using cookies)
- IndexedDB encryption via browser's built-in security

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile-First UI
- Stock board uses card-based layout on mobile
- Scan interface optimized for single-hand operation
- Touch-friendly button sizes (min 44px)
- Vertical scrolling prioritized

## State Flow Diagram

```
User Interaction
     ↓
React Component
     ↓
Form Validation (Zod)
     ↓
Network Check (useNetworkStatus)
     ↓
Online: Direct API Call → Server
Offline: Queue in IndexedDB
     ↓
IndexedDB Local Cache
     ↓
Component Re-render via React Query
     ↓
UI Update
```

## Future Enhancements

- Biometric authentication (Face ID, fingerprint)
- Real-time collaboration features
- Advanced analytics dashboard
- Mobile app (Expo/React Native)
- Dark theme support
- Multiple language support (English, Chinese)
