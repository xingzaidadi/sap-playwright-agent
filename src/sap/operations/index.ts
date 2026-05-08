/**
 * SAP ECC operation primitives.
 *
 * These classes are Adapter implementation details, not the framework core.
 * Flow definitions should call business-level actions through the Action
 * Registry instead of depending on these classes directly.
 */

export { EccLoginOps } from './ecc-login.js'
export { EccInvoiceOps } from './ecc-invoice-ops.js'
export { EccQueryOps } from './ecc-query-ops.js'
export { MiroOps } from './miro-ops.js'
export { PostOps } from './post-ops.js'
