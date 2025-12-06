import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017';
const DB_NAME = 'revision-scheduler';

async function fixCardColors() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const cardsCollection = db.collection('cards');
    const topicsCollection = db.collection('topics');

    // Get all topics
    const topics = await topicsCollection.find({}).toArray();
    console.log(`Found ${topics.length} topics`);

    const topicColorMap = {};
    topics.forEach(topic => {
      topicColorMap[topic.name.toLowerCase()] = topic.color;
    });

    // Get all cards
    const cards = await cardsCollection.find({}).toArray();
    console.log(`Found ${cards.length} cards to update`);

    let updatedCount = 0;

    for (const card of cards) {
      const topicLower = card.topic.toLowerCase();
      const correctColor = topicColorMap[topicLower];

      if (correctColor && card.topicColor !== correctColor) {
        await cardsCollection.updateOne(
          { _id: card._id },
          { $set: { topicColor: correctColor } }
        );
        console.log(`Updated card "${card.title}" from ${card.topicColor || 'no color'} to ${correctColor}`);
        updatedCount++;
      }
    }

    console.log(`\nSuccessfully updated ${updatedCount} cards`);

  } catch (error) {
    console.error('Error fixing card colors:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

fixCardColors();
