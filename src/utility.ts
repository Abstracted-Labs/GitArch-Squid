import { lookupArchive } from "@subsquid/archive-registry";
import * as ss58 from "@subsquid/ss58";
import {
  BatchContext,
  BatchProcessorItem,
  SubstrateBatchProcessor,
  toHex,
} from "@subsquid/substrate-processor";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
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

export function getAccount(m: Map<string, Account>, accountId: string): Account {
    // let acc = m.get(id);
    let acc = m.get(accountId);
    if (acc == null) {
        acc = new Account();
        acc.id = accountId;
        acc.accountId = accountId;
        m.set(accountId, acc);
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

      if (!ipsObj) {
        console.log("DEFAULT IPS OBJECT RETURNED!!!!!!!");
      }
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
export async function getIpsAccountObj(ctx: any, events: EventInfo, ipsAccountId: string, ipsId: number): Promise<[IpsAccount | undefined, string]> {
    // First check buffered events
    let ipsAccountObj = events.ipsAccounts.find(t => t[0].id === ipsAccountId)?.[0];
    let lookupSource = "BUFFER";
  
    if (!ipsAccountObj) {
      ipsAccountObj = await ctx.store.get(IpsAccount, ipsAccountId);

      console.log("BEFORE DB REMOVE");
      console.log(`\tipsAccountLookup: ${ipsAccountObj}`); 
      console.log(ipsAccountObj?.ips);
      console.log(ipsAccountObj?.account);

      // Only remove from database if it exists
      if (ipsAccountObj) {
        lookupSource = "DATABASE";
        // ips is just gone off of this object for some reason. Can't fathom why???
        ipsAccountObj.ips = await getIpsObj(ctx, events.ips, ipsId);

        console.log("AFTER DB REMOVE");
        console.log(ipsAccountObj.ips);
        console.log(ipsAccountObj.account);
      }
    }
  
    return [ipsAccountObj, lookupSource];
}
