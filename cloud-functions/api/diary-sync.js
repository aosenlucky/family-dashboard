import diarySync from '../../server/diary-sync.js'
import { runNodeHandler } from '../_node-handler-adapter.js'

export default function onRequest(context) {
  return runNodeHandler(diarySync, context)
}
