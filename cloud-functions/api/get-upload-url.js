import handler from '../../api/get-upload-url.js'
import { runNodeHandler } from '../_node-handler-adapter.js'

export default function onRequest(context) {
  return runNodeHandler(handler, context)
}
