# Mobile Testing Checklist - Quick Reference

Use this checklist when testing mobile responsiveness for new features or pages.

---

## Quick Device Tests

### Test Devices (minimum)
- [ ] iPhone SE (375px) - Smallest modern phone
- [ ] Standard Phone (390-430px) - iPhone 12-14
- [ ] Tablet Portrait (768px) - iPad Mini
- [ ] Tablet Landscape (1024px) - iPad Pro

### Test Browsers
- [ ] Safari iOS (primary)
- [ ] Chrome Mobile
- [ ] Firefox Mobile

---

## Component Checklist

### Buttons
- [ ] Minimum 44x44px touch target (`h-11 sm:h-10`)
- [ ] Adequate spacing between buttons
- [ ] Icons scale properly
- [ ] Loading states work
- [ ] Disabled states clear

### Forms
- [ ] All inputs 16px+ font size (`text-base sm:text-sm`)
- [ ] Fields stack on mobile (`grid-cols-1 md:grid-cols-2`)
- [ ] Labels visible and clear
- [ ] Error messages display properly
- [ ] Keyboard doesn't obscure inputs
- [ ] Date/time pickers work

### Tables
- [ ] Horizontal scroll on mobile
- [ ] Smooth touch scrolling (`-webkit-overflow-scrolling-touch`)
- [ ] Min-width set (`min-w-[640px]`)
- [ ] Headers align properly
- [ ] Action buttons tappable

### Modals
- [ ] Full-screen on mobile (`max-w-full sm:max-w-lg`)
- [ ] Slides up from bottom (`items-end sm:items-center`)
- [ ] Rounded top only on mobile (`rounded-t-xl sm:rounded-xl`)
- [ ] Content scrolls properly
- [ ] Footer buttons stack (`flex-col sm:flex-row`)
- [ ] Close button works (44x44px)

### Cards
- [ ] Responsive padding (`p-4 sm:p-6`)
- [ ] Stack properly in grids (`grid-cols-1 sm:grid-cols-2`)
- [ ] Content doesn't overflow
- [ ] Images scale correctly

### Navigation
- [ ] Mobile menu opens/closes smoothly
- [ ] Menu button 44x44px (`w-11 h-11`)
- [ ] All nav items tappable
- [ ] Overlay dismisses on tap
- [ ] Active state clear

---

## Layout Checklist

### Page Header
- [ ] Stacks on mobile (`flex-col sm:flex-row`)
- [ ] Actions button stack
- [ ] Title text wraps properly
- [ ] Spacing adequate (`gap-4`)

### Grids
- [ ] KPI cards: 2 cols mobile, 4 desktop (`grid-cols-2 sm:grid-cols-4`)
- [ ] Content cards: 1 col mobile, 2-3 desktop
- [ ] Gap responsive (`gap-3 sm:gap-4`)

### Charts
- [ ] Container has `overflow-hidden`
- [ ] ResponsiveContainer used
- [ ] Touch interactions work
- [ ] No horizontal scroll

### Lists
- [ ] Items have adequate spacing
- [ ] Touch targets 44px+
- [ ] Text doesn't overflow
- [ ] Actions tappable

---

## Interaction Tests

### Touch
- [ ] All buttons easy to tap (44x44px minimum)
- [ ] No accidental taps on nearby elements
- [ ] Swipe gestures don't conflict
- [ ] Smooth momentum scrolling
- [ ] No double-tap zoom (where inappropriate)

### Keyboard
- [ ] Inputs focusable via tab
- [ ] Focus ring visible
- [ ] Keyboard doesn't obscure fields
- [ ] Enter submits forms
- [ ] Escape closes modals

---

## Visual Tests

### Typography
- [ ] All text readable (16px+ minimum)
- [ ] Line height adequate (1.5+)
- [ ] Text doesn't overflow
- [ ] Contrast meets WCAG AA

### Spacing
- [ ] Touch targets spaced properly
- [ ] Padding feels comfortable
- [ ] No cramped layouts
- [ ] White space balanced

### Layout
- [ ] Nothing cut off or hidden
- [ ] No horizontal overflow
- [ ] Safe areas respected (notch, home indicator)
- [ ] Scrolling smooth (60fps)

---

## Functional Tests

### Forms
- [ ] Submit works on mobile
- [ ] Validation messages show
- [ ] Required fields enforced
- [ ] File uploads work
- [ ] Date pickers native or mobile-friendly

### Tables
- [ ] Sort works
- [ ] Filter works
- [ ] Pagination works
- [ ] Row click works
- [ ] Actions accessible

### Modals
- [ ] Open animation smooth
- [ ] Close on backdrop tap
- [ ] Close on X button
- [ ] Form submission works
- [ ] Scroll works

### Search
- [ ] Search field accessible
- [ ] Results display properly
- [ ] Clear button works
- [ ] No results state shown

---

## Performance Tests

### Load Time
- [ ] Page loads < 3s on 3G
- [ ] Images lazy load
- [ ] Fonts load without flash
- [ ] No layout shift (CLS)

### Animations
- [ ] 60fps smooth animations
- [ ] No jank on scroll
- [ ] Transitions smooth
- [ ] Reduced motion respected

### Memory
- [ ] No memory leaks
- [ ] Large lists virtualized
- [ ] Images optimized
- [ ] Components unmount cleanly

---

## Accessibility Tests

### Screen Reader
- [ ] VoiceOver (iOS) works
- [ ] All interactive elements labeled
- [ ] Logical reading order
- [ ] Dynamic content announced

### Contrast
- [ ] Text meets WCAG AA (4.5:1)
- [ ] Interactive elements visible
- [ ] Focus indicators clear
- [ ] Works in bright sunlight

### Touch Targets
- [ ] All interactive elements 44x44px+
- [ ] Adequate spacing between targets
- [ ] Clear tap feedback
- [ ] No tiny icons without labels

---

## Browser-Specific Tests

### Safari iOS
- [ ] No zoom on input focus (16px+ text)
- [ ] Momentum scrolling works
- [ ] Position fixed works
- [ ] Viewport meta tag set

### Chrome Mobile
- [ ] Pull-to-refresh doesn't interfere
- [ ] Viewport sizing correct
- [ ] Touch events work
- [ ] File uploads work

### Firefox Mobile
- [ ] Layout renders correctly
- [ ] Interactions work
- [ ] Performance acceptable

---

## Common Issues to Check

- [ ] iOS zoom on input (use 16px+ font)
- [ ] Buttons too small (use 44px+ height)
- [ ] Table breaking layout (add scroll)
- [ ] Modal too large (use full-screen)
- [ ] Cramped layout (add padding)
- [ ] Text too small (use 16px+)
- [ ] Grid not stacking (use mobile-first)
- [ ] Actions too close (add gap)
- [ ] Header overlap (check z-index)
- [ ] Safe area ignored (use safe-* classes)

---

## Sign-Off

Feature/Page Tested: ___________________________

Date: ________________

Tester: ___________________________

Devices Tested:
- [ ] iPhone SE (375px)
- [ ] iPhone 12+ (390-430px)
- [ ] iPad (768px+)

Critical Issues Found: ___ (must be 0 to pass)
Medium Issues Found: ___ (should be 0 to pass)
Low Issues Found: ___ (acceptable)

Status: [ ] Pass [ ] Fail [ ] Needs Review

Notes:
_____________________________________________
_____________________________________________
_____________________________________________

---

**Quick Tips:**
- Test on real devices, not just Chrome DevTools
- Test in both portrait and landscape
- Test with slow network (3G throttling)
- Test with VoiceOver enabled
- Test in bright sunlight if possible
