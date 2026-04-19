# CAROMAR
**C**opy **A** **R**epository **O**r **M**erge **A**ll **R**epositories

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-SITE-ID/deploy-status)](https://app.netlify.com/sites/YOUR-SITE-NAME/deploys)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/US-SPURS/CAROMAR)

A powerful web application that allows users to efficiently manage GitHub repositories by either forking individual repositories or merging multiple repositories into a single repository with organized folder structure.

![CAROMAR Interface](https://github.com/user-attachments/assets/a044e51e-4b80-4165-ada5-611b47eab378)

## 🚀 Quick Deploy

Deploy CAROMAR to Netlify with one click:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/US-SPURS/CAROMAR)

**[📖 Full Deployment Guide](./docs/deployment/netlify.md)**

---

## Features

### 🔐 GitHub Authentication
- Secure GitHub Personal Access Token integration
- User profile validation and display
- Token storage for session persistence

### 🔍 Repository Discovery
- Search repositories by GitHub username
- Support for both personal and other users' repositories
- Comprehensive repository information display
- Language detection and visual indicators

### 📋 Repository Selection
- Interactive repository grid with checkboxes
- Bulk selection controls (Select All/Deselect All)
- Real-time selection counter and status updates

### 🚀 Two Operation Modes

#### 1. Fork Individual Repositories
- Fork each selected repository individually to your GitHub account
- Preserves original repository structure and history
- Batch processing with progress tracking
- Error handling for failed forks

#### 2. Merge into Single Repository
- Combines multiple repositories into one organized repository
- Each source repository becomes a main folder
- Maintains separation while creating unified access
- Fully automated server-side merge execution (no manual git steps required)
- Repository descriptor validation (name/full_name/clone_url + duplicate detection) before merge
- Custom naming for the merged repository

### 📊 Progress Tracking
- Real-time progress bars during operations
- Detailed status messages
- Comprehensive results display with success/error reporting
- Direct links to newly created repositories

### 🎨 User Experience
- Responsive design for desktop and mobile devices
- Modern, clean interface with GitHub-inspired styling
- Intuitive workflow with step-by-step guidance
- Error notifications and success confirmations

---

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- GitHub Personal Access Token

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/US-SPURS/CAROMAR.git
   cd CAROMAR
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Validate deployment configuration:**
   ```bash
   npm run validate
   ```

5. **Start the application:**
   ```bash
   npm start
   ```

6. **Open your browser:**
   Navigate to `http://localhost:3000`

### Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

### Deployment

#### Deploy to Netlify (Recommended)

**Option 1: One-Click Deploy**
1. Click the "Deploy to Netlify" button above
2. Configure your site name
3. Deploy!

**Option 2: Manual Deploy with CLI**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

**Option 3: GitHub Integration**
1. Push to GitHub
2. Connect repository in Netlify Dashboard
3. Automatic deployments on every push

**📖 See [Netlify Deployment Guide](./docs/deployment/netlify.md) for detailed instructions**

---

## Usage Guide

### Step 1: Authentication
1. Visit the CAROMAR web application
2. Click "Create Personal Access Token" to generate a GitHub token
3. Enter your token and click "Validate Token"
4. Your GitHub profile will be displayed once validated

### Step 2: Find Repositories
1. Enter a GitHub username (yours or another user's)
2. Click "Search Repositories" to load their repositories
3. Browse the repository grid with detailed information

### Step 3: Select Operation Mode
Choose between two operation modes:

**Fork Individual Repositories:**
- Select repositories you want to fork
- Each will be forked individually to your account
- Maintains original repository structure

**Merge into Single Repository:**
- Select multiple repositories to combine
- Enter a name for the merged repository
- Creates one repository with all selected repos as folders

### Step 4: Execute Action
1. Select your desired repositories using checkboxes
2. Use "Select All" or "Deselect All" for bulk operations
3. Click the "Execute" button to start the process
4. Monitor progress with real-time status updates

### Step 5: Review Results
- View detailed results of the operation
- Access direct links to newly created repositories
- Review any errors or issues encountered

---

## GitHub Token Setup

To use CAROMAR, you need a GitHub Personal Access Token:

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select appropriate scopes:
   - ✅ `repo` (for repository access)
   - ✅ `user` (for user information)
4. Copy the generated token
5. Enter it in the CAROMAR application

**Security Note:** Your token is stored locally in your browser and used only for GitHub API calls. It's never sent to external servers.

---

## API Endpoints

The application provides several REST API endpoints:

### Authentication & User
- `GET /api/user` - Get authenticated user information
- `GET /api/validate-token` - Validate GitHub token and permissions

### Repository Management
- `GET /api/search-repos` - Search repositories for a user
- `POST /api/fork-repo` - Fork a specific repository
- `POST /api/create-merged-repo` - Create merged repository
- `GET /api/repo-content` - Get repository content preview

### Analytics & Comparison
- `POST /api/analyze-repos` - Analyze repository statistics
- `POST /api/compare-repos` - Compare multiple repositories

### System
- `GET /api/health` - Health check endpoint
- `GET /api/metrics` - Performance metrics

**📖 See [API Documentation](./docs/api/endpoints.md) for detailed API documentation**

---

## Technology Stack

### Frontend
- HTML5, CSS3, Vanilla JavaScript
- EJS templating engine
- Responsive design
- Real-time progress tracking

### Backend
- Node.js (v18+)
- Express.js
- Serverless-ready architecture
- RESTful API design

### Infrastructure
- Netlify Functions (Serverless)
- Netlify CDN (Static assets)
- GitHub REST API v3 integration

### Development
- Jest (Testing)
- ESLint (Linting)
- Nodemon (Development)

---

## Project Structure

```
CAROMAR/
├── public/                    # Static assets (served from CDN)
│   ├── css/
│   │   ├── style.css         # Application styling
│   │   └── icons-fallback.css # Icon fallbacks
│   ├── js/
│   │   ├── app.js            # Basic frontend
│   │   └── enhanced-app.js   # Full-featured frontend
│   ├── robots.txt            # SEO crawler rules
│   └── sitemap.xml           # SEO sitemap
├── views/
│   └── index.ejs             # Main HTML template
├── functions/
│   └── server.js             # Netlify serverless wrapper
├── utils/
│   ├── analytics.js          # Repository analytics
│   ├── comparison.js         # Repository comparison
│   ├── logger.js             # Logging utility
│   ├── validation.js         # Input validation
│   ├── performance.js        # Performance monitoring
│   └── security.js           # Security utilities
├── scripts/
│   └── validate-deployment.js # Pre-deploy validation
├── tests/
│   ├── app.test.js           # API tests
│   └── utils.test.js         # Utility tests
├── server.js                 # Express application
├── package.json              # Dependencies & scripts
├── netlify.toml              # Netlify configuration
├── .nvmrc                    # Node version
├── jest.config.js            # Jest configuration
├── eslint.config.js          # ESLint configuration
├── .env.example              # Environment template
├── README.md                 # This file
├── NETLIFY_DEPLOYMENT.md     # Deployment guide
├── DEPLOYMENT_FIXES.md       # Fixes summary
├── SETUP.md                  # Setup guide
├── DEVELOPMENT.md            # Development guide
├── API.md                    # API documentation
└── LICENSE                   # MIT License
```

---

## Development

### Available Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server with auto-reload
npm test               # Run tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run lint           # Check code quality
npm run lint:fix       # Fix linting issues
npm run build          # Build for production
npm run validate       # Validate deployment configuration
npm run predeploy      # Pre-deployment checks (lint + test)
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**📖 See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines**

---

## Documentation

### 📚 [Complete Documentation Index](./docs/README.md)

**Quick Links:**
- **[Quick Start Guide](./docs/guides/quickstart.md)** - Get started in 5 minutes
- **[Setup Guide](./docs/guides/setup.md)** - Detailed installation instructions
- **[Development Guide](./docs/guides/development.md)** - Architecture and development
- **[API Documentation](./docs/api/endpoints.md)** - Complete API reference
- **[Netlify Deployment](./docs/deployment/netlify.md)** - Deploy to Netlify
- **[Environment Config](./docs/deployment/environment.md)** - Configuration guide

**Project Documentation:**
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[SECURITY.md](./SECURITY.md)** - Security policy
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Support

### Get Help

If you encounter any issues or have questions:

1. **Check Documentation:**
   - [Documentation Index](./docs/README.md)
   - [Quick Start Guide](./docs/guides/quickstart.md)
   - [Deployment Guide](./docs/deployment/netlify.md)
   - [API Documentation](./docs/api/endpoints.md)

2. **Search Issues:**
   - Check [existing issues](https://github.com/US-SPURS/CAROMAR/issues)

3. **Create New Issue:**
   - [Report a bug](https://github.com/US-SPURS/CAROMAR/issues/new)
   - Include error messages and steps to reproduce

### Community

- **GitHub Discussions:** Ask questions and share ideas
- **Issue Tracker:** Report bugs and request features

---

## Acknowledgments

- **GitHub API** for repository management capabilities
- **Netlify** for serverless hosting platform
- **Font Awesome** for icons
- **Express.js** for backend framework
- Modern web standards for responsive design

---

## Status

✅ **Production Ready**  
✅ **Deployment Tested**  
✅ **Fully Documented**  
✅ **Security Hardened**

---

**Built with ❤️ by US-SPURS**

**Last Updated:** February 10, 2026
