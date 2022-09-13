import type {Result} from './support'

export type AnyId = AnyId_IpfId | AnyId_RmrkNft | AnyId_RmrkCollection | AnyId_IpsId

export interface AnyId_IpfId {
  __kind: 'IpfId'
  value: bigint
}

export interface AnyId_RmrkNft {
  __kind: 'RmrkNft'
  value: [number, number]
}

export interface AnyId_RmrkCollection {
  __kind: 'RmrkCollection'
  value: number
}

export interface AnyId_IpsId {
  __kind: 'IpsId'
  value: number
}
