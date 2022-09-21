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
} from "../model/generated";
import {
  Inv4IpsCreatedEvent, Inv4SubTokenCreatedEvent, Inv4MintedEvent
} from "../types/events";
import { bigintTransformer } from "../model/generated/marshal";
import { placeholder_addr, ipsPlaceholderObj} from "../defaults";
import { EventInfo, getIpsAccountObj, getIpsObj} from "../utility";


export async function handleMinted(ctx: any, item: any, events: any) {
    const e = new Inv4MintedEvent(ctx, item.event);
        
    const {token, target, amount} = e.asV2;

    const ipsId = token[0];
    const toAccount = toHex(target);
    const mint_amount = Number(bigintTransformer.to(amount));

    // If 0 tokens are minted to an account then nothing changes
    // Only care if amount is > 0
    if (amount > 0) {
      console.log(`---Minted---\n\tipsId: ${ipsId}\n\ttoAccount: ${toAccount}\n\tamount: ${mint_amount}\n`);

      /* 
      1. Check if a record already exists for that IPS-accountId pair
      2. If record exists, then 
          - get IpsAccount object
          - remove record from DB
          - update IpsAccount.tokenBalance in object
      3. If record does not exist, then
          - create new IpsAccount object
          - set IpsAccount.tokenBalance = mint_amout
          - push object to events
      */
      let ipsAccountLookup = await getIpsAccountObj(ctx, events.ipsAccounts, ipsId.toString() + "-" + toAccount);

      if (ipsAccountLookup) {
        // Calculate updated `tokenBalance`
        let balance = 0;
        let tokenBalance = ipsAccountLookup.tokenBalance ?? undefined // If null, default to undefined
        let existingBalance = Number(bigintTransformer.to(tokenBalance));
        console.log(`SubTokenCreated--existingBalance: ${existingBalance}`);
        balance = existingBalance + mint_amount;
        console.log(`SubTokenCreated--updatedBalance: ${balance}`);

        // Update tokenBalance
        ipsAccountLookup.tokenBalance = bigintTransformer.from(balance.toString());
      }
      // No record was found so create new
      else {
        let placeholder_acc = new Account({ id: placeholder_addr});
        let ips = await getIpsObj(ctx, events.ips, ipsId);

        // Create IpsAccount object
        ipsAccountLookup = new IpsAccount({
          id: ipsId.toString() + "-" + toAccount,
          account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
          ips: ips,
          tokenBalance: amount
        });
      }

      console.log(`ipsAccountLookup: ${ipsAccountLookup}`);            

      events.ipsAccounts.push([ipsAccountLookup, toAccount]);
      events.accountIds.add(toAccount);
    }
}
