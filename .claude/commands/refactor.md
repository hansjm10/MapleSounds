# Intelligent Refactoring

Refactor the following code: $ARGUMENTS

## Pre-Refactoring Analysis

1. **Current State Assessment**

   - Identify code smells
   - Measure complexity (cyclomatic, cognitive)
   - Find duplicated logic
   - Check test coverage
   - Note performance bottlenecks

2. **Refactoring Goals**
   - Improve readability
   - Reduce complexity
   - Enhance maintainability
   - Optimize performance
   - Ensure extensibility

## Refactoring Patterns to Consider

### Code Structure

- **Extract Method**: Break large functions into smaller ones
- **Extract Variable**: Make complex expressions readable
- **Inline Variable**: Remove unnecessary variables
- **Extract Class**: Group related functionality
- **Move Method**: Place methods in appropriate classes

### Simplification

- **Replace Conditional with Polymorphism**
- **Decompose Conditional**: Break complex if statements
- **Consolidate Duplicate Conditional Fragments**
- **Remove Dead Code**
- **Replace Magic Numbers with Constants**

### Object-Oriented

- **Extract Interface**: Define contracts
- **Pull Up Method**: Move to parent class
- **Push Down Method**: Move to subclass
- **Replace Inheritance with Composition**
- **Introduce Parameter Object**

### Functional Patterns

- **Replace Loops with Pipeline**
- **Extract Pure Functions**
- **Introduce Immutability**
- **Use Higher-Order Functions**
- **Apply Composition**

## Refactoring Process

1. **Ensure Tests Exist**

   - Run existing tests
   - Add tests if coverage is low
   - Create characterization tests

2. **Make Small Changes**

   - One refactoring at a time
   - Run tests after each change
   - Commit frequently

3. **Improve Names**

   - Variables should explain "what"
   - Functions should explain "how"
   - Classes should represent concepts

4. **Reduce Complexity**

   - Max 20 lines per function
   - Max 5 parameters per function
   - Single responsibility principle

5. **Optimize Performance**
   - Profile before optimizing
   - Focus on algorithmic improvements
   - Consider caching strategies

## Quality Checklist

Before completing:

- [ ] All tests pass
- [ ] Code is more readable
- [ ] Complexity is reduced
- [ ] No new bugs introduced
- [ ] Performance maintained/improved
- [ ] Documentation updated
- [ ] Style guidelines followed

## Example Transformations

### Before:

```javascript
function calc(x, y, z, t) {
  if (t == 1) {
    return x + y;
  } else if (t == 2) {
    return x - y;
  } else if (t == 3) {
    return x * y;
  } else if (t == 4 && y != 0) {
    return x / y;
  }
  return z;
}
```

### After:

```javascript
const Operations = {
  ADD: (x, y) => x + y,
  SUBTRACT: (x, y) => x - y,
  MULTIPLY: (x, y) => x * y,
  DIVIDE: (x, y) => (y !== 0 ? x / y : null),
};

function calculate(x, y, operation, defaultValue = 0) {
  const op = Operations[operation];
  return op ? (op(x, y) ?? defaultValue) : defaultValue;
}
```

Remember: Refactoring is about making code better without changing its behavior. Always have tests!
