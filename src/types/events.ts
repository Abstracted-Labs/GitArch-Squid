import assert from 'assert'
import {Chain, ChainContext, EventContext, Event, Result} from './support'
import * as v2 from './v2'

export class Inv4IpsCreatedEvent {
  private readonly _chain: Chain
  private readonly event: Event

  constructor(ctx: EventContext)
  constructor(ctx: ChainContext, event: Event)
  constructor(ctx: EventContext, event?: Event) {
    event = event || ctx.event
    assert(event.name === 'INV4.IPSCreated')
    this._chain = ctx._chain
    this.event = event
  }

  /**
   * An IP Set was created
   */
  get isV2(): boolean {
    return this._chain.getEventHash('INV4.IPSCreated') === '291e98c309376f7a07d133c183af22ffe4734c228e6814e21bbbc4a45dc2b297'
  }

  /**
   * An IP Set was created
   */
  get asV2(): {ipsAccount: Uint8Array, ipsId: number, assets: v2.AnyId[]} {
    assert(this.isV2)
    return this._chain.decodeEvent(this.event)
  }
}

export class Inv4SubTokenCreatedEvent {
  private readonly _chain: Chain
  private readonly event: Event

  constructor(ctx: EventContext)
  constructor(ctx: ChainContext, event: Event)
  constructor(ctx: EventContext, event?: Event) {
    event = event || ctx.event
    assert(event.name === 'INV4.SubTokenCreated')
    this._chain = ctx._chain
    this.event = event
  }

  /**
   * One of more sub tokens were created
   */
  get isV2(): boolean {
    return this._chain.getEventHash('INV4.SubTokenCreated') === '8c334a504274f31551140e80026e91f96bc44748821473d87c6f3af085fe2bb1'
  }

  /**
   * One of more sub tokens were created
   */
  get asV2(): {subTokensWithEndowment: [[number, number], Uint8Array, bigint][]} {
    assert(this.isV2)
    return this._chain.decodeEvent(this.event)
  }
}
