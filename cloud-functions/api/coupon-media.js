import handler from '../../api/coupon-media.js'
import { runNodeHandler } from '../_node-handler-adapter.js'
export default function onRequest(context) { return runNodeHandler(handler, context) }
