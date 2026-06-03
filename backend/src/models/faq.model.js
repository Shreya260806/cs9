import { questionSchema } from './question.model.js'
import { faqConnection } from '../config/db.js'

const FAQQuestion = faqConnection.model('FAQQuestion', questionSchema)
export default FAQQuestion
