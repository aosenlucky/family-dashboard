import handler from '../../api/coupon-reminders.js'
import { runNodeHandler } from '../_node-handler-adapter.js'
export default function onRequest(context) { return runNodeHandler(handler, context) }
