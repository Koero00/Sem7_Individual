import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://catalog:8000';
const catalogPath = __ENV.CATALOG_PATH || '/';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}${catalogPath}`, {
    timeout: '5s',
    tags: { name: 'catalog-read' },
  });
  check(response, {
    'Catalog returns HTTP 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(0.2);
}
