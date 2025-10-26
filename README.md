# Revision Scheduler

A spaced repetition web app using the FSRS algorithm to help you remember what you learn. Track your learning topics and get notified when it's time to review them based on scientifically-proven memory retention patterns.

## Features

- Add topics you've learned with optional notes
- Review topics when they're due using FSRS algorithm
- Rate your recall (Again/Hard/Good/Easy)
- Automatic calculation of optimal review intervals
- Track statistics (total topics, due reviews, reviewed today)
- View all your topics and their review schedules
- MongoDB persistent storage

## Prerequisites

- Node.js (v18 or higher)
- MongoDB running locally on `mongodb://localhost:27017`
  - Or modify the connection string in `db.js`

## Installation

1. Install MongoDB if you haven't already:
   ```bash
   # macOS
   brew install mongodb-community
   brew services start mongodb-community

   # Or run manually
   mongod --dbpath /path/to/data/directory
   ```

2. Dependencies are already installed, but if needed:
   ```bash
   npm install
   ```

## Running the App

Start the server:
```bash
npm start
```

Or with auto-reload during development:
```bash
npm run dev
```

Then open your browser to: **http://localhost:3000**

## How to Use

### 1. Add New Topics
- Click "Add New Topic" tab
- Enter a **Topic/Category** (e.g., "Python", "Mathematics", "Spanish")
- Enter a **Title** for what you learned (e.g., "List Comprehensions", "Quadratic Formula")
- Optionally add notes or details
- Click "Add Topic"

### 2. Review Topics
- Click "Review Now" tab
- For each topic, rate your recall:
  - **Again**: Forgot completely
  - **Hard**: Barely remembered
  - **Good**: Remembered normally
  - **Easy**: Remembered easily
- The algorithm automatically schedules the next review

### 3. View All Topics
- Click "All Topics" tab
- See all your learning topics grouped by category
- Check next review dates (automatically shown in your local timezone)
- Delete topics if needed

## How FSRS Works

The Free Spaced Repetition Scheduler (FSRS) algorithm:
- Adapts to your individual memory patterns
- Uses three variables: difficulty, stability, and retrievability
- Calculates optimal review intervals based on your ratings
- Improves retention while minimizing review time

## MongoDB Schema

Cards are stored with the following structure:
```javascript
{
  topic: String,           // Category (e.g., "Python", "Math")
  title: String,           // What you're learning (e.g., "List Comprehensions")
  content: String,         // Optional notes
  createdAt: Date,         // When you added it (stored in UTC, displayed in local timezone)
  nextReview: Date,        // When to review next (stored in UTC, displayed in local timezone)
  lastReviewed: Date,      // Last review date (stored in UTC, displayed in local timezone)
  fsrsCard: Object,        // FSRS algorithm state
  reviewHistory: [         // History of reviews
    {
      date: Date,
      rating: Number,
      ratingText: String
    }
  ]
}
```

## Configuration

To use a different MongoDB connection:
```bash
MONGODB_URL="mongodb://your-host:port" npm start
```

Or edit `db.js` line 4.

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Algorithm**: FSRS (ts-fsrs)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## API Endpoints

- `GET /api/cards/all` - Get all cards
- `GET /api/cards/due` - Get cards due for review
- `POST /api/cards` - Add new card
- `POST /api/cards/:id/review` - Submit review
- `DELETE /api/cards/:id` - Delete card
- `GET /api/stats` - Get statistics

## License

MIT
