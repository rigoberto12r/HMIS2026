# Mobile Responsiveness Guide - HMIS Frontend

## Overview
This document outlines the mobile responsiveness strategy, breakpoints, patterns, and testing guidelines for the HMIS frontend application.

---

## Breakpoints

The application uses Tailwind CSS breakpoints:

| Breakpoint | Min Width | Target Devices |
|------------|-----------|----------------|
| `sm` | 640px | Large phones (landscape), small tablets |
| `md` | 768px | Tablets (portrait) |
| `lg` | 1024px | Tablets (landscape), small laptops |
| `xl` | 1280px | Desktop monitors |
| `2xl` | 1536px | Large desktop monitors |

### Mobile-First Approach
All styles are written mobile-first, meaning:
- Base styles apply to mobile (< 640px)
- Use `sm:`, `md:`, `lg:` prefixes for larger screens
- Example: `text-base sm:text-sm` (16px on mobile, 14px on desktop)

---

## Design Principles

### 1. Touch Target Size
**Minimum size: 44x44px** (Apple Human Interface Guidelines)

- Buttons: `h-11 sm:h-10` (44px on mobile, 40px on desktop)
- Icon buttons: `h-11 w-11 sm:h-10 sm:w-10`
- Use `.touch-target` utility class for custom elements

### 2. Font Sizing
**Minimum text size: 16px** to prevent iOS auto-zoom on input focus

- Inputs: `text-base sm:text-sm` (16px mobile, 14px desktop)
- Body text: `text-base` (16px)
- Small text: `text-sm` (14px) - use sparingly on mobile

### 3. Spacing
**Generous padding on mobile** for easier tapping

- Container padding: `p-4 sm:p-6`
- Gap between elements: `gap-3 sm:gap-4`
- Modal padding: `p-4 sm:p-5`

### 4. Layout Stacking
**Stack elements vertically on mobile**

- Headers: `flex-col sm:flex-row`
- Forms: Grid columns collapse on mobile
- Tables: Horizontal scroll with min-width

---

## Component-Specific Guidelines

### DataTable
```tsx
// Horizontal scroll on mobile with touch scrolling
<div className="overflow-x-auto -webkit-overflow-scrolling-touch">
  <table className="min-w-[640px]">
    {/* Table content */}
  </table>
</div>
```

**Features:**
- Horizontal scroll on mobile (smooth touch scrolling)
- Minimum width enforced for proper column display
- Pagination controls stack vertically on mobile

### Modal
```tsx
// Full-screen on mobile, centered dialog on desktop
<Modal size="md"> {/* md = full width mobile, max-w-lg desktop */}
```

**Features:**
- Slides up from bottom on mobile (better UX)
- Rounded top corners only on mobile
- Full-screen height with scroll
- Footer buttons stack vertically on mobile

### Buttons
```tsx
// Proper touch targets
<Button size="md"> {/* 44px height on mobile */}
```

**Features:**
- Minimum 44px touch target on mobile
- Text may be shorter on mobile (use responsive text)
- Icons scale appropriately

### Forms
```tsx
// Stack form fields on mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input label="First Name" />
  <Input label="Last Name" />
</div>
```

**Features:**
- Single column on mobile
- 16px font size on inputs (prevents zoom)
- Labels always visible
- Error messages clearly displayed

### Cards
```tsx
// Responsive padding and spacing
<Card padding="sm"> {/* Less padding on mobile */}
```

**Features:**
- Reduced padding on mobile (`p-4` instead of `p-6`)
- KPI cards: 2 columns on mobile, 4 on desktop
- Charts: Full width with overflow handling

### Sidebar
**Features:**
- Hamburger menu on mobile (slide-in drawer)
- Fixed overlay when open
- Full-screen navigation
- Collapsible on desktop

### Top Bar
**Features:**
- Accounts for mobile menu button (left padding)
- Search hidden on small screens
- User info abbreviated on mobile

---

## Mobile Utilities

Custom utility classes in `globals.css`:

```css
/* Touch Target */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* iOS Safe Areas */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-left { padding-left: env(safe-area-inset-left); }
.safe-right { padding-right: env(safe-area-inset-right); }

/* Smooth Touch Scrolling */
.scroll-touch {
  -webkit-overflow-scrolling: touch;
}

/* Hide Scrollbar */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Mobile Text Base */
.text-mobile-base {
  font-size: 16px; /* Prevents iOS zoom */
}

/* Full Bleed on Mobile */
.mobile-full-bleed {
  @media (max-width: 640px) {
    margin-left: -1rem;
    margin-right: -1rem;
    width: calc(100% + 2rem);
  }
}
```

---

## Common Patterns

### Page Header
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="page-title">Page Title</h1>
    <p className="page-subtitle">Subtitle text</p>
  </div>
  <div className="flex flex-col sm:flex-row gap-2">
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </div>
</div>
```

### Stats Grid
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
  <KpiCard title="..." value="..." />
  {/* More cards */}
</div>
```

### Form Layout
```tsx
<div className="space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Input label="Field 1" />
    <Input label="Field 2" />
  </div>
  <div className="md:col-span-2">
    <Textarea label="Full Width Field" />
  </div>
</div>
```

### Charts
```tsx
<div className="h-64 overflow-hidden">
  <ResponsiveContainer width="100%" height="100%">
    {/* Chart content */}
  </ResponsiveContainer>
</div>
```

---

## Testing Checklist

### Device Testing
- [ ] iPhone SE (375px) - Smallest modern phone
- [ ] iPhone 12/13 (390px) - Common phone size
- [ ] iPhone 14 Pro Max (430px) - Large phone
- [ ] iPad Mini (768px) - Small tablet
- [ ] iPad Pro (1024px) - Large tablet

### Browser Testing
- [ ] Safari iOS (primary mobile browser)
- [ ] Chrome Mobile
- [ ] Firefox Mobile
- [ ] Samsung Internet

### Functionality Tests

#### Navigation
- [ ] Mobile menu opens/closes smoothly
- [ ] All menu items are tappable (44x44px)
- [ ] Menu overlay closes on backdrop tap
- [ ] Active page is highlighted

#### Forms
- [ ] All inputs are 16px+ (no zoom on iOS)
- [ ] Labels are visible and clear
- [ ] Error messages display properly
- [ ] Keyboard doesn't obscure inputs
- [ ] Date/time pickers work on mobile

#### Tables
- [ ] Tables scroll horizontally on mobile
- [ ] Scroll is smooth (momentum scrolling)
- [ ] Headers stay aligned
- [ ] Actions buttons are tappable

#### Modals
- [ ] Modals slide up from bottom on mobile
- [ ] Content scrolls properly
- [ ] Footer buttons are tappable
- [ ] Close button works
- [ ] Backdrop dismisses modal

#### Charts
- [ ] Charts resize properly
- [ ] Touch interactions work (zoom, pan)
- [ ] Tooltips appear on tap
- [ ] No horizontal overflow

#### Cards & Lists
- [ ] Cards stack properly on mobile
- [ ] Spacing is appropriate
- [ ] Text doesn't overflow
- [ ] Images scale correctly

### Interaction Tests
- [ ] All buttons are easy to tap (44x44px minimum)
- [ ] Buttons don't feel cramped
- [ ] No accidental taps on nearby elements
- [ ] Swipe gestures don't conflict with navigation
- [ ] Pull-to-refresh doesn't interfere

### Visual Tests
- [ ] Text is readable (minimum 16px)
- [ ] Spacing feels comfortable
- [ ] Nothing is cut off or hidden
- [ ] Safe areas respected (notch, home indicator)
- [ ] Dark mode works (if applicable)

### Performance Tests
- [ ] Page loads quickly on 3G
- [ ] Smooth scrolling (60fps)
- [ ] No layout shift
- [ ] Images are optimized
- [ ] Animations are smooth

---

## Common Issues & Solutions

### Issue: iOS Zoom on Input Focus
**Solution:** Use `text-base` (16px) on all inputs
```tsx
<input className="text-base sm:text-sm" />
```

### Issue: Buttons Too Small
**Solution:** Use mobile-first button sizes
```tsx
<Button size="md"> {/* 44px on mobile */}
```

### Issue: Table Breaking Layout
**Solution:** Add horizontal scroll
```tsx
<div className="overflow-x-auto">
  <table className="min-w-[640px]">
```

### Issue: Modal Too Large on Mobile
**Solution:** Use responsive modal sizes
```tsx
<Modal size="lg"> {/* Full screen mobile, max-w-2xl desktop */}
```

### Issue: Cramped Layout
**Solution:** Add responsive padding
```tsx
<div className="p-4 sm:p-6">
```

### Issue: Text Too Small
**Solution:** Use responsive text sizing
```tsx
<p className="text-base sm:text-sm">
```

### Issue: Grid Not Stacking
**Solution:** Use mobile-first grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2">
```

---

## Performance Optimization

### Images
- Use responsive images with srcset
- Lazy load below-the-fold images
- Optimize and compress images
- Use WebP format when possible

### Code Splitting
- Lazy load charts/heavy components
- Split routes appropriately
- Use dynamic imports

### CSS
- Purge unused Tailwind classes
- Minimize custom CSS
- Use CSS containment where appropriate

### JavaScript
- Minimize bundle size
- Use production builds
- Remove console.logs
- Optimize re-renders (React.memo, useMemo)

---

## Accessibility on Mobile

### Touch Targets
- Minimum 44x44px for all interactive elements
- Add padding around small icons
- Use `touch-manipulation` CSS to disable double-tap zoom

### Screen Readers
- Test with VoiceOver (iOS) and TalkBack (Android)
- Ensure proper ARIA labels
- Logical tab/focus order
- Announce dynamic content changes

### Contrast
- Maintain WCAG AA contrast ratios
- Test in bright sunlight conditions
- Ensure text is readable on all backgrounds

---

## Resources

### Documentation
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design for Mobile](https://material.io/design/layout/responsive-layout-grid.html)

### Testing Tools
- [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode/)
- [BrowserStack](https://www.browserstack.com/) - Real device testing
- [Responsively App](https://responsively.app/) - Multi-device preview

### Browser Extensions
- [Mobile Simulator](https://chrome.google.com/webstore) - Chrome extension
- [Viewport Resizer](https://chrome.google.com/webstore) - Quick breakpoint testing

---

## Maintenance

### Regular Checks
- Test on real devices monthly
- Review analytics for mobile issues
- Update for new device sizes
- Monitor performance metrics

### Updates
- Keep Tailwind CSS updated
- Review new mobile patterns
- Update documentation as needed
- Train team on mobile best practices

---

**Last Updated:** 2026-02-07
**Maintained By:** HMIS Development Team
