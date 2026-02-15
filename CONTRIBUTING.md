# Contributing to RSS Mix Feed

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/news-rss-feed.git
   cd news-rss-feed
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```
5. Initialize database:
   ```bash
   npm run migrate
   ```
6. Start development server:
   ```bash
   npm run dev
   ```

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical architecture.

```
src/
├── app/              # Next.js pages and API routes
├── components/       # React components
├── lib/             # Business logic
└── types/           # TypeScript definitions
```

## Coding Standards

### TypeScript

- Use strict mode
- Provide explicit types for function parameters and return values
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes, types for unions/primitives

### Code Style

- **Formatter**: Prettier (auto-format on save)
- **Linter**: ESLint (run `npm run lint` before committing)
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Required

### Component Guidelines

- Use functional components with hooks
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use TypeScript for prop types

### File Naming

- Components: PascalCase (e.g., `FeedCard.tsx`)
- Utilities: camelCase (e.g., `deduplicator.ts`)
- Types: PascalCase (e.g., `feed.ts` exporting `FeedItem`)

## Git Workflow

### Branching Strategy

- `main` - production-ready code
- `feature/feature-name` - new features
- `fix/bug-description` - bug fixes
- `docs/what-changed` - documentation updates

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes

**Examples:**
```
feat(feed): add sorting by source
fix(api): handle RSS parsing errors gracefully
docs(readme): update deployment instructions
refactor(components): extract theme logic to hook
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Write or update tests if applicable
4. Run linter: `npm run lint`
5. Test build: `npm run build`
6. Commit with conventional commit messages
7. Push to your fork
8. Open a pull request to `main`

**PR Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if needed)
```

## Testing

### Manual Testing

Before submitting a PR:

1. Test on different screen sizes (mobile, tablet, desktop)
2. Test both light and dark modes
3. Test infinite scroll behavior
4. Verify links open correctly
5. Check API responses in Network tab

### Automated Tests (Future)

Currently V1 has no automated tests. Contributions adding tests are welcome!

**Testing framework recommendations:**
- Unit tests: Vitest
- Component tests: React Testing Library
- E2E tests: Playwright

## Adding New Features

### RSS Source

To add a new RSS source:

1. Update `src/lib/rss-fetcher.ts`:
   ```typescript
   const NEW_SOURCE_URL = process.env.NEW_SOURCE_RSS_URL || "https://...";

   export async function fetchNewSource(): Promise<RawFeedEntry[]> {
     // Implement fetching logic
   }
   ```

2. Update `fetchAllFeeds()` to include new source

3. Add environment variable to `.env.example`

4. Update source mixing weights in `src/lib/feed-mixer.ts`

5. Add source color to `src/components/FeedCard.tsx`

### UI Component

To add a new UI component:

1. Create component in `src/components/`:
   ```typescript
   // src/components/NewComponent.tsx
   import { FeedItem } from "@/types/feed";

   interface NewComponentProps {
     // Props
   }

   export default function NewComponent({ }: NewComponentProps) {
     return (
       <div>
         {/* Implementation */}
       </div>
     );
   }
   ```

2. Add styles using Tailwind classes
3. Ensure dark mode support (`dark:` variants)
4. Test on mobile and desktop

### API Endpoint

To add a new API endpoint:

1. Create route file: `src/app/api/your-endpoint/route.ts`
2. Implement GET/POST/etc handlers:
   ```typescript
   import { NextRequest, NextResponse } from "next/server";

   export async function GET(request: NextRequest) {
     // Implementation
     return NextResponse.json({ data: "..." });
   }
   ```
3. Add error handling
4. Document in README.md

## Code Review Guidelines

When reviewing PRs:

- **Code quality**: Is the code clean and maintainable?
- **Performance**: Are there any obvious performance issues?
- **Security**: Are there any security vulnerabilities?
- **Accessibility**: Is the UI accessible (contrast, keyboard nav)?
- **Mobile**: Does it work on mobile devices?
- **Documentation**: Are new features documented?

## Reporting Bugs

Use GitHub Issues with this template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Device: [e.g. iPhone 12, Desktop]
- OS: [e.g. iOS 15, macOS 12]
- Browser: [e.g. Safari 15, Chrome 96]

**Additional context**
Any other relevant information.
```

## Feature Requests

Use GitHub Issues with this template:

```markdown
**Feature Description**
Clear description of the feature.

**Use Case**
Why is this feature needed?

**Proposed Solution**
How do you envision this working?

**Alternatives Considered**
Other approaches you've thought about.

**Additional Context**
Mockups, examples, or related issues.
```

## Questions?

- Check [README.md](./README.md) for general information
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
- Open a GitHub Discussion for general questions
- Open an Issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on what's best for the project
- Show empathy towards other contributors

Thank you for contributing! 🎉
