# Contribution Guidelines

Thank you for your interest in contributing to CAROMAR! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- Git
- GitHub account

### Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/CAROMAR.git
   cd CAROMAR
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (optional for basic development)
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## 📝 How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear description** of the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** for UI issues
- **Environment information** (OS, browser, Node.js version)
- **Error messages** or console logs

### Suggesting Features

Feature suggestions are welcome! Please provide:

- **Clear description** of the feature
- **Use case** and benefits
- **Implementation ideas** (if any)
- **Screenshots or mockups** (for UI features)

### Pull Requests

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes:**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

3. **Commit your changes:**
   ```bash
   git commit -m "Add amazing feature
   
   - Detailed description of changes
   - Any breaking changes noted
   - Related issue numbers"
   ```

4. **Push to your fork:**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request:**
   - Use the provided PR template
   - Include screenshots for UI changes
   - Reference related issues
   - Ensure CI checks pass

## 🎨 Code Style Guidelines

### JavaScript
- Use ES6+ features (const/let, arrow functions, destructuring)
- Use semicolons consistently
- Use camelCase for variables and functions
- Use PascalCase for classes
- Add JSDoc comments for functions

### CSS
- Use meaningful class names
- Follow BEM methodology where applicable
- Use CSS custom properties for theming
- Ensure responsive design principles

### HTML
- Use semantic HTML elements
- Include proper ARIA labels for accessibility
- Ensure proper heading hierarchy
- Validate markup

## 🧪 Testing Guidelines

### Writing Tests
- Write tests for new functionality
- Include both positive and negative test cases
- Mock external dependencies (GitHub API)
- Aim for good test coverage

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📚 Documentation

### Code Documentation
- Add JSDoc comments to functions
- Include parameter and return type information
- Document complex logic with inline comments
- Update API documentation for new endpoints

### User Documentation
- Update README.md for new features
- Add usage examples
- Include screenshots for UI changes
- Update troubleshooting guides

## 🏗️ Architecture Guidelines

### Backend Development
- Follow RESTful API conventions
- Implement proper error handling
- Use appropriate HTTP status codes
- Include input validation
- Add rate limiting for new endpoints (see `utils/security.js`'s
  `RateLimiter` and the `tokenAwareRateLimit` middleware in `server.js`)

### Frontend Development
- Use the existing class-based architecture
- The application uses `enhanced-app.js` (EnhancedCaromarApp class) in production
- `app.js` is a simplified version maintained for reference/minimal implementation
- Implement responsive design
- Add proper loading states
- Include accessibility features
- Follow progressive enhancement principles

## 🔒 Security Guidelines

### Token Handling
- Never log or store tokens server-side
- Validate token permissions
- Use secure transmission (HTTPS)
- Implement proper error handling

### Input Validation
- Sanitize all user inputs (`utils/validation.js`, `utils/security.js`)
- Validate on both client and server
- Use parameterized queries
- Implement CSRF protection where needed (`isAllowedOrigin` /
  `ALLOWED_ORIGINS` — see `docs/deployment/environment.md`)

## 🚀 Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH**
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes (backward compatible)

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version number bumped
- [ ] Changelog updated
- [ ] Security review completed

## 📋 Issue Labels

We use the following labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested
- `wontfix` - This will not be worked on

## 🆘 Getting Help

### Communication Channels
- **GitHub Issues** - For bug reports and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Pull Request Reviews** - For code-related discussions

### Resources
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Express.js Documentation](https://expressjs.com/)
- [Jest Testing Framework](https://jestjs.io/)

## 📄 License

By contributing to CAROMAR, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors are recognized in the following ways:
- Listed in the Contributors section of README.md
- Mentioned in release notes for significant contributions
- GitHub contributor statistics

## ❓ Questions?

Don't hesitate to ask questions! You can:
- Open an issue with the `question` label
- Start a discussion in GitHub Discussions
- Comment on relevant issues or pull requests

Thank you for contributing to CAROMAR! 🎉
