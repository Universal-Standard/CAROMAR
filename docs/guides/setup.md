# CAROMAR Setup Guide

This guide will help you get CAROMAR up and running quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- A **GitHub Personal Access Token** - [Create one here](https://github.com/settings/tokens)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/US-SPURS/CAROMAR.git
cd CAROMAR
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js (web server)
- Axios (HTTP client)
- EJS (templating engine)
- ESLint (code quality)
- Jest (testing framework)

### 3. Configure Environment (Optional)

The application comes with sensible defaults in the `.env` file. You can customize these if needed:

```bash
# Server Configuration
PORT=3000                    # Port to run the server on
NODE_ENV=production          # Environment mode
LOG_LEVEL=INFO              # Logging level (INFO, DEBUG, WARN, ERROR)
```

### 4. Start the Application

```bash
npm start
```

The application will start on `http://localhost:3000`

For development with auto-reload:
```bash
npm run dev
```

### 5. Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "CAROMAR Access")
4. Select the following scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `user` - Read/write user profile data
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again!)

### 6. Use CAROMAR

1. Open your browser and navigate to `http://localhost:3000`
2. Paste your GitHub token in the authentication section
3. Click "Validate Token"
4. Enter a GitHub username to search for repositories
5. Select repositories and choose an operation:
   - **Fork Individual Repositories** - Fork each selected repo to your account
   - **Merge into Single Repository** - Create one repo containing all selected repos as folders

## Features

### Repository Operations
- **Search** - Find repositories by username or organization
- **Filter** - Sort and filter by language, type, activity
- **Fork** - Fork individual repositories to your account
- **Merge** - Combine multiple repositories into one organized repo

### Analytics
- Generate comprehensive analytics reports on selected repositories
- View language distribution, top repositories, and activity metrics
- Analyze repository health and engagement

### Comparison
- **Two-way Comparison** - Detailed comparison between two repositories
- **Multiple Comparison** - Compare metrics across many repositories
- **Best Repository** - Find the best repository by specific criteria

### Advanced Features
- **Export/Import** - Save and restore repository selections
- **Keyboard Shortcuts** - Efficient navigation (press Help button to view)
- **Real-time Progress** - Track operation progress with live updates
- **Rate Limit Monitoring** - Track GitHub API usage

## Development

### Run Tests

```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### Linting

Check code quality:
```bash
npm run lint
```

Auto-fix linting issues:
```bash
npm run lint:fix
```

### Project Structure

```
CAROMAR/
├── public/
│   ├── css/
│   │   ├── style.css              # Main styles
│   │   └── icons-fallback.css     # Icon fallbacks
│   └── js/
│       ├── app.js                 # Basic frontend implementation
│       └── enhanced-app.js        # Full-featured frontend (used in production)
├── views/
│   └── index.ejs                  # Main HTML template
├── utils/
│   ├── logger.js                  # Logging utility
│   ├── validation.js              # Input validation
│   ├── analytics.js               # Repository analytics
│   └── comparison.js              # Repository comparison
├── tests/
│   ├── app.test.js                # API endpoint tests
│   └── utils.test.js              # Utility function tests
├── server.js                       # Express server
├── package.json                    # Dependencies
├── jest.config.js                  # Jest testing configuration
├── eslint.config.js                # ESLint configuration
├── .env                           # Environment configuration
├── LICENSE                         # MIT License
└── README.md                       # Main documentation
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, change it in `.env`:
```bash
PORT=3001
```

### GitHub API Rate Limiting

- **Authenticated requests**: 5,000 per hour
- **Unauthenticated requests**: 60 per hour

Always use a personal access token for better rate limits.

### Token Validation Fails

Ensure your token has the required scopes:
- `repo` - For repository operations
- `user` - For user information

### CDN Resources Blocked

If Font Awesome icons don't load, the app automatically falls back to emoji icons. This is normal and doesn't affect functionality.

## Security Best Practices

1. **Never commit your token** - It's stored in browser localStorage only
2. **Regenerate tokens periodically** - For better security
3. **Use fine-grained tokens** - When possible, for minimal permissions
4. **Monitor your GitHub security settings** - Regularly check for suspicious activity

## Support

For issues, questions, or feature requests:

1. Check the [main README](./README.md)
2. Review the [API documentation](./API.md)
3. Search [existing issues](https://github.com/US-SPURS/CAROMAR/issues)
4. Create a [new issue](https://github.com/US-SPURS/CAROMAR/issues/new)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to CAROMAR.

## License

This project is licensed under the MIT License.
