# AI-Based Psychological Support Platform

A comprehensive AI-powered psychological support platform built with Next.js, featuring multilingual support, video/voice calling, and advanced AI integration.

## 🌟 Features

### Core Functionality
- **AI-Powered Psychology Sessions** - Interactive sessions with AI psychologists
- **Video & Voice Calling** - Real-time communication with AI characters
- **Multilingual Support** - 25+ languages with native accent synthesis
- **Real-time Translation** - Automatic translation and localization
- **Secure Authentication** - User registration and login system

### Advanced Features
- **Speech Recognition** - Advanced voice processing and transcription
- **Enhanced Speech Synthesis** - Native accent support for multiple languages
- **Video Avatar System** - Interactive AI characters with video responses
- **Real-time Chat** - Text-based AI conversations
- **Responsive Design** - Mobile-first, fully responsive interface

## 🚀 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **AI Integration**: OpenAI API with AI SDK
- **Speech**: Web Speech API + Enhanced Synthesis
- **Video Processing**: Custom video avatar system
- **Deployment**: Vercel (optimized)

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- pnpm 8+ (recommended)
- Git

### Setup Instructions

1. **Clone the repository**
\`\`\`bash
git clone https://github.com/your-username/ai-psychological-support.git
cd ai-psychological-support
\`\`\`

2. **Install dependencies**
\`\`\`bash
pnpm install
\`\`\`

3. **Environment Setup**
\`\`\`bash
cp .env.example .env.local
\`\`\`

Fill in your environment variables:
\`\`\`env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=http://localhost:3000

# Webhook Configuration
NEXT_PUBLIC_WEBHOOK_URL=your_n8n_webhook_url

# Additional Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
\`\`\`

4. **Run the development server**
\`\`\`bash
pnpm dev
\`\`\`

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Building for Production

\`\`\`bash
# Build the application
pnpm build

# Start production server
pnpm start

# Type checking
pnpm type-check

# Linting
pnpm lint
\`\`\`

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
\`\`\`bash
git add .
git commit -m "Initial commit"
git push origin main
\`\`\`

2. **Deploy to Vercel**
- Connect your GitHub repository to Vercel
- Add environment variables in Vercel dashboard
- Deploy automatically on push

### Other Platforms

The application supports deployment on:
- **Netlify** - Static site hosting
- **Railway** - Full-stack deployment
- **DigitalOcean App Platform** - Container deployment
- **AWS Amplify** - Serverless deployment

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `NEXTAUTH_SECRET` | NextAuth secret key | ✅ |
| `NEXT_PUBLIC_WEBHOOK_URL` | n8n webhook URL | ✅ |
| `NEXTAUTH_URL` | Application URL | ✅ |

### Supabase Setup

1. Create a new Supabase project
2. Set up authentication providers
3. Configure database tables
4. Add environment variables

### OpenAI Setup

1. Create OpenAI account
2. Generate API key
3. Add to environment variables
4. Configure usage limits

## 📱 Features Overview

### Authentication System
- **Secure Registration** - Email/password with validation
- **Login System** - Secure authentication flow
- **Password Recovery** - Reset password functionality
- **Protected Routes** - Route-level authentication

### AI Psychology Sessions
- **Multiple AI Characters** - Dr. Alexander, Dr. Sophia, Dr. Maria
- **Video Interactions** - Real-time video responses
- **Voice Recognition** - Advanced speech processing
- **Multilingual Support** - 25+ supported languages

### Communication Features
- **Video Calling** - High-quality video sessions
- **Voice Calling** - Audio-only sessions
- **Text Chat** - Real-time messaging
- **Screen Sharing** - Advanced communication tools

### Internationalization
- **25+ Languages** - Comprehensive language support
- **RTL Support** - Right-to-left language support
- **Native Accents** - Authentic pronunciation
- **Auto-translation** - Real-time translation

## 🛠️ Development

### Project Structure
\`\`\`
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── (auth)/            # Authentication pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── ui/               # UI components
│   └── ...               # Feature components
├── lib/                  # Utility libraries
│   ├── auth/             # Authentication logic
│   ├── i18n/             # Internationalization
│   └── ...               # Other utilities
├── hooks/                # Custom React hooks
├── public/               # Static assets
└── types/                # TypeScript definitions
\`\`\`

### Key Components
- **Video Call Dialog** - Advanced video calling interface
- **Voice Call Dialog** - Audio communication system
- **AI Chat Dialog** - Text-based AI conversations
- **Language Selector** - Multi-language support
- **Authentication Forms** - Login/registration UI

### Custom Hooks
- **useAuth** - Authentication state management
- **useLanguage** - Language and translation
- **useSpeechSynthesis** - Enhanced speech synthesis
- **useAutoTranslate** - Automatic translation

## 🔒 Security

### Authentication Security
- **Secure Password Hashing** - bcrypt encryption
- **JWT Tokens** - Secure session management
- **CSRF Protection** - Cross-site request forgery protection
- **Rate Limiting** - API request limiting

### Data Protection
- **Environment Variables** - Secure configuration
- **HTTPS Enforcement** - Secure data transmission
- **Input Validation** - XSS and injection prevention
- **Privacy Controls** - User data protection

## 🧪 Testing

\`\`\`bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
\`\`\`

## 📊 Performance

### Optimization Features
- **Code Splitting** - Automatic bundle optimization
- **Image Optimization** - Next.js image optimization
- **Caching Strategy** - Efficient caching implementation
- **Lazy Loading** - Component lazy loading

### Monitoring
- **Performance Metrics** - Core Web Vitals tracking
- **Error Tracking** - Comprehensive error monitoring
- **Analytics Integration** - User behavior tracking

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
\`\`\`bash
git checkout -b feature/amazing-feature
\`\`\`
3. **Make your changes**
4. **Add tests if applicable**
5. **Commit your changes**
\`\`\`bash
git commit -m 'Add amazing feature'
\`\`\`
6. **Push to the branch**
\`\`\`bash
git push origin feature/amazing-feature
\`\`\`
7. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write comprehensive tests
- Update documentation for new features
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation** - Check this README and code comments
- **Issues** - Create GitHub issues for bugs
- **Discussions** - Use GitHub discussions for questions
- **Email** - Contact support@ai-psychologist.com

### Common Issues
- **Build Errors** - Check Node.js and pnpm versions
- **Environment Variables** - Verify all required variables are set
- **Supabase Connection** - Check database configuration
- **OpenAI API** - Verify API key and usage limits

## 🗺️ Roadmap

### Upcoming Features
- **Mobile App** - React Native implementation
- **Advanced Analytics** - Detailed session analytics
- **Group Sessions** - Multi-user psychology sessions
- **AI Training** - Custom AI model training
- **Integration APIs** - Third-party service integration

### Version History
- **v0.1.0** - Initial release with core features
- **v0.2.0** - Enhanced video calling and multilingual support
- **v0.3.0** - Advanced AI integration and security improvements

## 🙏 Acknowledgments

- **Next.js Team** - Amazing React framework
- **Supabase** - Backend-as-a-Service platform
- **OpenAI** - AI API and models
- **Vercel** - Deployment and hosting platform
- **Radix UI** - Accessible UI components
- **Tailwind CSS** - Utility-first CSS framework

---

**Built with ❤️ for mental health support and AI innovation**
