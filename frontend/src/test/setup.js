import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement these; DocumentReader observes its scroll container and
// individual page elements with both.
class StubObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

global.ResizeObserver = global.ResizeObserver || StubObserver;
global.IntersectionObserver = global.IntersectionObserver || StubObserver;
