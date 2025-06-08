# Implement Code Review Changes

Implement changes suggested in a code review for pull request: $ARGUMENTS

Follow these steps:

1. **Get Latest PR Comments**

   - Use `gh pr view $ARGUMENTS --comments` to get all review comments
   - Focus on the most recent feedback and unresolved comments
   - Identify specific change requests and suggestions

2. **Checkout PR Branch**

   - Use `gh pr checkout $ARGUMENTS` to switch to the PR branch
   - Ensure you're working on the correct branch
   - Pull latest changes: `git pull origin <branch-name>`

3. **Analyze Review Feedback**

   - Read through all review comments carefully
   - Categorize feedback into:
     - Required changes (blocking issues)
     - Suggestions for improvement
     - Questions needing clarification
   - Prioritize changes by impact and reviewer urgency

4. **Plan Implementation**

   - Create a todo list for each review comment
   - Group related changes together
   - Consider dependencies between changes

5. **Research Required Changes**

   - Use Context7 commands for library/framework questions
   - Use Brave search for best practices or patterns
   - Check CLAUDE.md for project-specific guidelines

6. **Implement Changes**

   - Address each review comment systematically
   - Write tests first for new functionality (TDD approach)
   - Maintain existing functionality while making improvements
   - Follow the project's coding standards and patterns

7. **Verify All Changes**

   - Run all relevant tests for modified areas
   - Test both new functionality and existing features
   - Ensure no regressions were introduced

8. **Quality Assurance**

   - Run linting: `npm run lint`
   - Run type checking: `npm run typecheck`
   - Run full test suite: `npm test`
   - Fix any issues that arise

9. **Update Documentation**

   - Update code comments if logic changed significantly
   - Update any affected documentation files
   - Ensure inline documentation matches new behavior

10. **Commit and Push Changes**

    - Create descriptive commit messages for each logical change
    - Reference the original review comments in commit messages
    - Push changes: `git push`
    - Reply to review comments indicating how they were addressed

11. **Request Re-review**
    - Comment on the PR summarizing changes made
    - Use `gh pr comment $ARGUMENTS --body "Changes implemented: ..."`
    - Request re-review from the original reviewers

Remember: Address feedback constructively and ask for clarification if any review comments are unclear!
