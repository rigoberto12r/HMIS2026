// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock localStorage
let store = {}

global.localStorage = {
  getItem: jest.fn((key) => store[key] || null),
  setItem: jest.fn((key, value) => {
    store[key] = value.toString()
  }),
  removeItem: jest.fn((key) => {
    delete store[key]
  }),
  clear: jest.fn(() => {
    store = {}
  }),
  get length() {
    return Object.keys(store).length
  },
  key: jest.fn((index) => {
    const keys = Object.keys(store)
    return keys[index] || null
  }),
}

// Mock HTMLDialogElement (not supported by jsdom)
HTMLDialogElement.prototype.showModal = jest.fn()
HTMLDialogElement.prototype.close = jest.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
