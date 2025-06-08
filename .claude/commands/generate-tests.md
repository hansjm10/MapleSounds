# Generate Comprehensive Tests

Generate comprehensive tests for: $ARGUMENTS

## Analysis Phase

1. **Understand the Code**

   - Read the target file/function
   - Identify all code paths
   - Note external dependencies
   - List possible edge cases

2. **Identify Test Categories**
   - Happy path scenarios
   - Error conditions
   - Edge cases
   - Performance considerations
   - Security vulnerabilities

## Test Generation Strategy

### Unit Tests

Generate tests for:

- Each public function/method
- Different input combinations
- Boundary conditions
- Error handling paths
- Return value validation

### Integration Tests

Consider:

- Component interactions
- API endpoint testing
- Database operations
- External service mocks
- State management

### Edge Cases to Cover

- Null/undefined inputs
- Empty arrays/objects
- Maximum/minimum values
- Concurrent operations
- Network failures
- Invalid data types
- Resource exhaustion

## Test Structure

```javascript
describe('<Component/Function>', () => {
  // Setup and teardown
  beforeEach(() => {
    // Initialize test state
  });

  afterEach(() => {
    // Cleanup
  });

  // Happy path tests
  describe('when used correctly', () => {
    it('should <expected behavior>', () => {
      // Arrange
      // Act
      // Assert
    });
  });

  // Error scenarios
  describe('when errors occur', () => {
    it('should handle <error type>', () => {
      // Test error handling
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should handle <edge case>', () => {
      // Test boundaries
    });
  });
});
```

## Coverage Goals

- Line coverage: >90%
- Branch coverage: >85%
- Function coverage: 100%
- Critical path coverage: 100%

## Additional Considerations

1. Mock external dependencies
2. Test async operations properly
3. Verify error messages
4. Check performance benchmarks
5. Validate type safety
6. Test accessibility (if UI)
7. Verify security measures

Generate tests that are:

- Readable and well-documented
- Independent and isolated
- Fast and reliable
- Maintainable
- Comprehensive

Remember: Good tests are the best documentation!
