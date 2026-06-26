module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:8080/', 'http://localhost:8080/orders', 'http://localhost:8080/menu'],
      numberOfRuns: 1,
      staticDistDir: '../'
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }]
      }
    }
  }
};
