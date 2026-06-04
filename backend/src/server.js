import './dns-init.js'

// 2. Load the rest of your app
import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'
import { startQuestionAssignmentCron } from './scheduled/question-assignment.js'

const port = Number(process.env.PORT) || 5000

try {
  await connectDB()
  startQuestionAssignmentCron()
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
} catch (error) {
  console.error(`Server startup failed: ${error.message}`)
  process.exit(1)
}