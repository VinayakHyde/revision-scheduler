import express from 'express';
import { fsrs, Rating, createEmptyCard, generatorParameters } from 'ts-fsrs';
import { connectDB, getDB } from './db.js';
import { ObjectId } from 'mongodb';

const app = express();
const port = 3000;

// Initialize FSRS with default parameters
const f = fsrs(generatorParameters());

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
await connectDB();

// API Routes

// Get all topics
app.get('/api/topics', async (req, res) => {
  try {
    const db = getDB();
    const topics = await db.collection('topics')
      .find()
      .sort({ name: 1 })
      .toArray();
    res.json(topics);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Create or update a topic
app.post('/api/topics', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    if (!color || !color.trim()) {
      return res.status(400).json({ error: 'Color is required' });
    }

    const db = getDB();
    const topicName = name.trim();

    // Check if topic already exists
    const existingTopic = await db.collection('topics').findOne({ name: topicName });

    if (existingTopic) {
      // Update the color
      await db.collection('topics').updateOne(
        { name: topicName },
        { $set: { color: color.trim() } }
      );
      const updatedTopic = await db.collection('topics').findOne({ name: topicName });
      res.json(updatedTopic);
    } else {
      // Create new topic
      const newTopic = {
        name: topicName,
        color: color.trim(),
        createdAt: new Date()
      };
      const result = await db.collection('topics').insertOne(newTopic);
      const insertedTopic = await db.collection('topics').findOne({ _id: result.insertedId });
      res.status(201).json(insertedTopic);
    }
  } catch (error) {
    console.error('Error creating/updating topic:', error);
    res.status(500).json({ error: 'Failed to create/update topic' });
  }
});

// Get all cards
app.get('/api/cards/all', async (req, res) => {
  try {
    const db = getDB();
    const cards = await db.collection('cards')
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(cards);
  } catch (error) {
    console.error('Error fetching all cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Get cards due for review
app.get('/api/cards/due', async (req, res) => {
  try {
    const db = getDB();
    const now = new Date();
    const cards = await db.collection('cards')
      .find({ nextReview: { $lte: now } })
      .sort({ nextReview: 1 })
      .toArray();
    res.json(cards);
  } catch (error) {
    console.error('Error fetching due cards:', error);
    res.status(500).json({ error: 'Failed to fetch due cards' });
  }
});

// Add a new card
app.post('/api/cards', async (req, res) => {
  try {
    const { topic, title, content, topicColor } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDB();
    const now = new Date();

    // Get or create topic with color
    const topicName = topic.trim();
    let topicDoc = await db.collection('topics').findOne({ name: topicName });

    if (!topicDoc && topicColor) {
      // Create new topic if it doesn't exist
      const newTopic = {
        name: topicName,
        color: topicColor.trim(),
        createdAt: now
      };
      await db.collection('topics').insertOne(newTopic);
      topicDoc = newTopic;
    }

    // Create a new card using FSRS
    const emptyCard = createEmptyCard(now);

    // Schedule first review for tomorrow (24 hours from now)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newCard = {
      topic: topicName,
      topicColor: topicDoc?.color || topicColor || '#6366f1', // Store color with card
      title: title.trim(),
      content: content?.trim() || '',
      createdAt: now,
      nextReview: tomorrow, // First review scheduled for tomorrow
      fsrsCard: emptyCard, // FSRS state
      reviewHistory: []
    };

    const result = await db.collection('cards').insertOne(newCard);
    const insertedCard = await db.collection('cards').findOne({ _id: result.insertedId });

    res.status(201).json(insertedCard);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// Submit a review
app.post('/api/cards/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    // Validate rating
    const validRatings = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
    if (!validRatings.includes(rating)) {
      return res.status(400).json({ error: 'Invalid rating. Must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)' });
    }

    const db = getDB();
    const card = await db.collection('cards').findOne({ _id: new ObjectId(id) });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const now = new Date();

    // Use FSRS to calculate next review
    const schedulingCard = f.next(card.fsrsCard, now, rating);

    // Update card with new FSRS state and next review date
    const reviewRecord = {
      date: now,
      rating: rating,
      ratingText: ['Again', 'Hard', 'Good', 'Easy'][rating - 1]
    };

    const updateResult = await db.collection('cards').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          fsrsCard: schedulingCard.card,
          nextReview: schedulingCard.card.due,
          lastReviewed: now
        },
        $push: {
          reviewHistory: reviewRecord
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const updatedCard = await db.collection('cards').findOne({ _id: new ObjectId(id) });
    res.json(updatedCard);
  } catch (error) {
    console.error('Error reviewing card:', error);
    res.status(500).json({ error: 'Failed to review card' });
  }
});

// Undo last review
app.post('/api/cards/:id/undo', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const db = getDB();
    const card = await db.collection('cards').findOne({ _id: new ObjectId(id) });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Check if there's a review to undo
    if (!card.reviewHistory || card.reviewHistory.length === 0) {
      return res.status(400).json({ error: 'No reviews to undo' });
    }

    // Remove the last review from history
    const reviewHistory = card.reviewHistory.slice(0, -1);

    // Restore the previous FSRS state
    // If there are no more reviews, reset to empty card
    let previousFsrsCard;
    let previousNextReview;

    if (reviewHistory.length === 0) {
      // No previous reviews, reset to initial state
      const createdAt = card.createdAt || new Date();
      previousFsrsCard = createEmptyCard(createdAt);
      // Schedule for tomorrow (same as initial creation)
      previousNextReview = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // Recalculate FSRS state by replaying all remaining reviews
      const createdAt = card.createdAt || new Date();
      let fsrsCard = createEmptyCard(createdAt);
      let reviewDate = createdAt;

      // Replay each review in order
      for (const review of reviewHistory) {
        const schedulingCard = f.next(fsrsCard, review.date, review.rating);
        fsrsCard = schedulingCard.card;
        reviewDate = review.date;
      }

      previousFsrsCard = fsrsCard;
      previousNextReview = fsrsCard.due;
    }

    // Update the card
    const updateResult = await db.collection('cards').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          fsrsCard: previousFsrsCard,
          nextReview: previousNextReview,
          reviewHistory: reviewHistory,
          lastReviewed: reviewHistory.length > 0 ? reviewHistory[reviewHistory.length - 1].date : null
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const updatedCard = await db.collection('cards').findOne({ _id: new ObjectId(id) });
    res.json(updatedCard);
  } catch (error) {
    console.error('Error undoing review:', error);
    res.status(500).json({ error: 'Failed to undo review' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const db = getDB();
    const now = new Date();

    const totalCards = await db.collection('cards').countDocuments();
    const dueCards = await db.collection('cards').countDocuments({ nextReview: { $lte: now } });
    const reviewedToday = await db.collection('cards').countDocuments({
      lastReviewed: { $gte: new Date(now.setHours(0, 0, 0, 0)) }
    });

    res.json({
      totalCards,
      dueCards,
      reviewedToday
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Update a card
app.put('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDB();
    const updateData = {
      title: title.trim(),
      content: content?.trim() || ''
    };

    const result = await db.collection('cards').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const updatedCard = await db.collection('cards').findOne({ _id: new ObjectId(id) });
    res.json(updatedCard);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Delete a card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const db = getDB();
    const result = await db.collection('cards').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

app.listen(port, () => {
  console.log(`Revision Scheduler running at http://localhost:${port}`);
});
