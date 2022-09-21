import { lookupArchive } from "@subsquid/archive-registry";
import * as ss58 from "@subsquid/ss58";
import {
  BatchContext,
  BatchProcessorItem,
  SubstrateBatchProcessor,
  toHex,
} from "@subsquid/substrate-processor";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
import { from } from "form-data";
import { In } from "typeorm";
import {
  Account,
  Ips,
  IpsAccount
} from "./model/generated";
import {
  Inv4IpsCreatedEvent, Inv4SubTokenCreatedEvent, Inv4MintedEvent
} from "./types/events";
import { bigintTransformer } from "./model/generated/marshal";
import { handleMinted } from "./handlers";
import { placeholder_addr, ipsPlaceholderObj} from "./defaults";


export type Tuple<T,K> = [T,K];
export interface EventInfo {
  ips: Tuple<Ips, string>[];
  ipsAccounts: Tuple<IpsAccount, string>[];
  accountIds: Set<string>;
}

export function getAccount(m: Map<string, Account>, id: string, accountId: string): Account {
    let acc = m.get(id);
    if (acc == null) {
        acc = new Account();
        acc.id = id;
        acc.accountId = accountId;
        m.set(id, acc);
    }
    return acc;
    }
  
function randomNum(): Number {
return Math.floor(Math.random() * 1_000_000_000_000);
}
  
export async function getIpsObj(ctx: any, events: Tuple<Ips, string>[], ipsId: Number): Promise<Ips> {
const defaultIpsObj = new Ips({
    id: ipsId.toString(),
    accountId: placeholder_addr
});

// First check buffered events
let ipsObj = events.find(t => t[0].id === ipsId.toString())?.[0];

// Then check storage
if (!ipsObj) {
    ipsObj = await ctx.store.get(Ips, ipsId.toString());
}

return ipsObj ?? defaultIpsObj;
}
  
  /* 
  1. Check if a record already exists for that IPS-accountId pair
  2. If record exists, then 
      - get IpsAccount object
      - remove record from DB
      - update IpsAccount.tokenBalance in object
      - push object to events
  3. If record does not exist, then
      - create new IpsAccount object
      - set IpsAccount.tokenBalance = amount
      - push object to events
  */
export async function getIpsAccountObj(ctx: any, events: Tuple<IpsAccount, string>[], ipsAccountId: string): Promise<IpsAccount | undefined> {
    // First check buffered events
    let ipsAccountObj = events.find(t => t[0].id === ipsAccountId)?.[0];
  
    if (!ipsAccountObj) {
      ipsAccountObj = await ctx.store.get(IpsAccount, ipsAccountId.toString());
      await ctx.store.remove(IpsAccount, ipsAccountId);
    }
    else {
      // If found in the events array remove obj from the array as it will be re-added in the calling function
      events.filter(ips => ips[0].id !== ipsAccountId);
    }
  
    return ipsAccountObj;
}