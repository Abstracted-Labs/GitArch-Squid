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

export class Inv4MintedEvent {
  private readonly _chain: Chain
  private readonly event: Event

  constructor(ctx: EventContext)
  constructor(ctx: ChainContext, event: Event)
  constructor(ctx: EventContext, event?: Event) {
    event = event || ctx.event
    assert(event.name === 'INV4.Minted')
    this._chain = ctx._chain
    this.event = event
  }

  get isTinkerNodeV1(): boolean {
    return this._chain.getEventHash('INV4.Minted') === 'b23d7899b64e6561a43a448ba54912c773e38204c17783250a2e93895da45274'
  }

  get asTinkerNodeV1(): [[number, (number | undefined)], Uint8Array, bigint] {
    assert(this.isTinkerNodeV1)
    return this._chain.decodeEvent(this.event)
  }

  /**
   * IP Tokens were minted
   */
  get isV2(): boolean {
    return this._chain.getEventHash('INV4.Minted') === '99ced0a0c16abf6ee327a1e6890151d82bf50ee1568b0f6dab89ac438c39e818'
  }

  /**
   * IP Tokens were minted
   */
  get asV2(): {token: [number, (number | undefined)], target: Uint8Array, amount: bigint} {
    assert(this.isV2)
    return this._chain.decodeEvent(this.event)
  }
}
