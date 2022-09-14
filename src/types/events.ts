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
