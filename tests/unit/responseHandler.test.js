const { success, fail } = require('../../src/utils/responseHandler');

describe('Response Handler', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('success', () => {
    it('should return success response with defaults', () => {
      success(mockRes, 'Operation successful', { foo: 'bar' });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Operation successful',
        data: { foo: 'bar' },
      });
    });

    it('should return success response with custom status code', () => {
      success(mockRes, 'Created', { id: 1 }, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Created',
        data: { id: 1 },
      });
    });
  });

  describe('fail', () => {
    it('should return fail response with defaults', () => {
      fail(mockRes, 'Something went wrong');

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Something went wrong',
      });
    });
  });
});
