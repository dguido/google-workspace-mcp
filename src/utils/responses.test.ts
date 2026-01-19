import { describe, it, expect, vi } from 'vitest';
import { successResponse, errorResponse } from './responses.js';

vi.mock('./logging.js', () => ({
  log: vi.fn()
}));

describe('successResponse', () => {
  it('returns correct structure with text', () => {
    const result = successResponse('Operation successful');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Operation successful' }],
      isError: false
    });
  });

  it('handles empty string', () => {
    const result = successResponse('');
    expect(result).toEqual({
      content: [{ type: 'text', text: '' }],
      isError: false
    });
  });
});

describe('errorResponse', () => {
  it('returns correct structure with error message', () => {
    const result = errorResponse('Something went wrong');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: Something went wrong' }],
      isError: true
    });
  });

  it('prefixes message with Error:', () => {
    const result = errorResponse('test');
    expect(result.content[0].text).toBe('Error: test');
  });
});
