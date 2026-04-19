import { request } from './lib';
import { StatusCodes } from 'http-status-codes';
import { articlesRoutes, categoriesRoutes } from './endpoints';

describe('Pagination', () => {
  const commonHeaders = { Accept: 'application/json' };

  it('should list categories with pagination wrapper when requested', async () => {
    // Create categories to paginate through
    await request
      .post(categoriesRoutes.create)
      .set(commonHeaders)
      .send({ name: 'Cat A', description: 'desc' });
    await request
      .post(categoriesRoutes.create)
      .set(commonHeaders)
      .send({ name: 'Cat B', description: 'desc' });

    const response = await request
      .get(`${categoriesRoutes.getAll}?page=1&limit=1`)
      .set(commonHeaders);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 1);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBe(1);
  });

  it('should handle missing page and limit by falling back to standard responses gracefully', async () => {
    const ascResponse = await request
      .get(`${articlesRoutes.getAll}?sortBy=title&order=asc`)
      .set(commonHeaders);

    // Because no page or limit is provided, it should gracefully return the array format
    // directly so that normal fundamental tests don't break.
    expect(ascResponse.status).toBe(StatusCodes.OK);
    expect(ascResponse.body).toBeInstanceOf(Array);
  });

  it('should correctly paginate secondary offsets', async () => {
    // Request explicitly from an offset
    const response = await request
      .get(`${categoriesRoutes.getAll}?page=2&limit=2`)
      .set(commonHeaders);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 2);
    expect(response.body).toHaveProperty('limit', 2);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
