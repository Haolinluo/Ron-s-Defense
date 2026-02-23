# Ron Nova Defense (Ron新星防御)

A classic Missile Command style tower defense game built with React, Vite, and Tailwind CSS.

## Features
- Continuous "Machine Gun" firing mechanism.
- Predict rocket paths and use explosion AoE to destroy enemies.
- Multi-language support (Chinese/English).
- Responsive design for mobile and desktop.
- Synthesized sound effects using Web Audio API.

## Deployment to Vercel

To deploy this project to Vercel via GitHub:

1.  **Create a GitHub Repository**: Create a new repository on GitHub and push this code to it.
2.  **Connect to Vercel**:
    -   Go to [Vercel](https://vercel.com/) and click "Add New" -> "Project".
    -   Import your GitHub repository.
3.  **Configure Environment Variables**:
    -   In the Vercel project settings, add the following environment variable:
        -   `GEMINI_API_KEY`: Your Google Gemini API key (if you plan to use AI features).
4.  **Deploy**: Click "Deploy". Vercel will automatically detect Vite and build the project.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Animations**: Motion
- **Icons**: Lucide React
