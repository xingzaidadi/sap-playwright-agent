import { logger } from './logger.js'

const TOOLSKIT_BASE = process.env.TOOLSKIT_BASE_URL || 'https://toolskit.test.mi.com'

interface APIResponse {
  root: {
    code: number
    msg: string
    data: unknown[]
  }
}

/**
 * Toolskit API 工具
 *
 * 参考截图 image_08/09/10/17/18/19:
 * - 修改小米用户绑定供应商关系: POST /isc/sourcing-data/updateByFields
 * - 查询采购订单详情: POST /sap/ecc/getByOptions (EKKO表)
 * - 查询外部代理供应商: POST /sap/ecc/getByOptions (EKPO)
 */
export class ToolskitAPI {
  private token: string

  constructor(token?: string) {
    this.token = token || process.env.TOOLSKIT_TOKEN || ''
  }

  /**
   * 绑定供应商关系
   * 参考截图 image_08: ZTBO_RELATION 表, OBJID=对账单ID, REL_OBJID=供应商号
   *
   * 用途: 在创建对账单前，将小米用户绑定为供应商代理
   */
  async bindSupplierRelation(settlementId: string, vendorId: string): Promise<boolean> {
    logger.info(`Binding supplier relation: settlement=${settlementId}, vendor=${vendorId}`)

    const payload = new URLSearchParams({
      IV_TABLENAME: 'ZTBO_RELATION',
      IV_WHERE: `OBJID ='${settlementId}'`,
      IV_SET: `REL_OBJID ='${vendorId}'`,
      IV_ACTION: 'U',
    })

    try {
      const resp = await fetch(`${TOOLSKIT_BASE}/isc/sourcing-data/updateByFields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: payload.toString(),
      })

      const data = await resp.json() as APIResponse
      if (data.root.code === 200) {
        logger.success('Supplier relation bound successfully')
        return true
      }
      logger.error(`Bind failed: ${data.root.msg}`)
      return false
    } catch (error) {
      logger.error(`API error: ${error}`)
      return false
    }
  }

  /**
   * 解绑供应商关系（清空 REL_OBJID）
   * 参考截图 image_09: IV_SET = REL_OBJID = ''
   */
  async unbindSupplierRelation(settlementId: string): Promise<boolean> {
    logger.info(`Unbinding supplier relation: settlement=${settlementId}`)

    const payload = new URLSearchParams({
      IV_TABLENAME: 'ZTBO_RELATION',
      IV_WHERE: `OBJID ='${settlementId}'`,
      IV_SET: `REL_OBJID = ''`,
      IV_ACTION: 'U',
    })

    try {
      const resp = await fetch(`${TOOLSKIT_BASE}/isc/sourcing-data/updateByFields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: payload.toString(),
      })

      const data = await resp.json() as APIResponse
      return data.root.code === 200
    } catch (error) {
      logger.error(`API error: ${error}`)
      return false
    }
  }

  /**
   * 查询采购订单详情 (EKKO表)
   * 参考截图 image_25: query_table=EKKO, result_fields=EBELN,BUKRS,BSART...
   *
   * 返回: [PO号, 公司代码, 订单类型, 供应商, 采购组织, 采购组, 货币...]
   */
  async queryPODetails(poNumber: string): Promise<Record<string, string> | null> {
    logger.info(`Querying PO details: ${poNumber}`)

    const payload = new URLSearchParams({
      query_table: 'EKKO',
      result_fields: 'EBELN,BUKRS,BSART,LIFNR,EKORG,EKGRP,WAERS',
      query_options: `EBELN=${poNumber}`,
      row_count: '10',
    })

    try {
      const resp = await fetch(`${TOOLSKIT_BASE}/sap/ecc/getByOptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: payload.toString(),
      })

      const data = await resp.json() as APIResponse
      if (data.root.code === 200 && data.root.data.length > 0) {
        // 数据格式: ["4500197633","1100","ZYZ","0000101550","2120","P01","USD","20250708"]
        const row = data.root.data[0] as string
        const fields = JSON.parse(row) as string[]
        const result: Record<string, string> = {
          poNumber: fields[0] || '',
          companyCode: fields[1] || '',
          orderType: fields[2] || '',
          vendor: fields[3] || '',
          purchasingOrg: fields[4] || '',
          purchasingGroup: fields[5] || '',
          currency: fields[6] || '',
        }
        logger.info(`PO details: ${JSON.stringify(result)}`)
        return result
      }
      return null
    } catch (error) {
      logger.error(`API error: ${error}`)
      return null
    }
  }

  /**
   * 查询外部代理供应商
   * 参考截图 image_18: query_table=EKKO, 查询 ZZ_HDGYS 字段
   */
  async queryExternalAgent(poNumber: string): Promise<string | null> {
    logger.info(`Querying external agent for PO: ${poNumber}`)

    const payload = new URLSearchParams({
      query_table: 'EKKO',
      result_fields: 'EBELN,ZZ_HDGYS',
      query_options: `EBELN=${poNumber}`,
      row_count: '10',
    })

    try {
      const resp = await fetch(`${TOOLSKIT_BASE}/sap/ecc/getByOptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: payload.toString(),
      })

      const data = await resp.json() as APIResponse
      if (data.root.code === 200 && data.root.data.length > 0) {
        const row = data.root.data[0] as string
        const fields = JSON.parse(row) as string[]
        return fields[1] || null  // ZZ_HDGYS = 外部代理供应商号
      }
      return null
    } catch (error) {
      logger.error(`API error: ${error}`)
      return null
    }
  }

  /**
   * 查询采购订单历史记录
   * 参考截图 image_10: /sap/ecc/getByOptions
   */
  async queryPOHistory(poNumber: string): Promise<unknown[]> {
    logger.info(`Querying PO history: ${poNumber}`)

    const payload = new URLSearchParams({
      query_table: 'EKBE',
      result_fields: 'EBELN,EBELP,VGABE,BELNR,BUDAT,MENGE,WRBTR',
      query_options: `EBELN=${poNumber}`,
      row_count: '100',
    })

    try {
      const resp = await fetch(`${TOOLSKIT_BASE}/sap/ecc/getByOptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: payload.toString(),
      })

      const data = await resp.json() as APIResponse
      if (data.root.code === 200) {
        return data.root.data
      }
      return []
    } catch (error) {
      logger.error(`API error: ${error}`)
      return []
    }
  }
}
