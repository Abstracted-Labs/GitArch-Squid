import {
    toHex,
  } from "@subsquid/substrate-processor";
  import {
    Account,
    IpsAccount
  } from "../model/generated";
  import {
    Inv4BurnedEvent
  } from "../types/events";
  import { bigintTransformer } from "../model/generated/marshal";
  import { placeholder_addr} from "../defaults";
  import { EventInfo, getIpsAccountObj, getIpsObj} from "../utility";
  
  
  export async function handleBurned(ctx: any, item: any, events: EventInfo) {
      const e = new Inv4BurnedEvent(ctx, item.event);
          
      const {token, target, amount} = e.asV2;
  
      const ipsId = token[0];
      const subToken = token[1];
      const toAccount = toHex(target);
      const burn_amount = Number(bigintTransformer.to(amount));
  
      // If 0 tokens are burned from an account then nothing changes
      // Only care if amount is > 0
      if (burn_amount > 0) {
        console.log(`---Burned---\n\tipsId: ${ipsId}\n\tsub token: ${subToken}\n\tfrom account: ${toAccount}\n\tamount burned: ${burn_amount}`);
  
        /* 
        1. Check if a record already exists for that IPS-accountId pair
        2. If record exists, then 
            - get IpsAccount object
            - compute if IpsAccount.tokenBalance - burn_amount <= 0
                - if yes, remove record from IpsAccount
                - if no, update IpsAccount.tokenBalance in object
        3. If record does not exist, then do nothing (likely an issue with Minted or SubTokenCreated events)
        */
        let lookupId = ipsId.toString() + "-" + toAccount;
        let lookup = await getIpsAccountObj(ctx, events, lookupId, ipsId);
        let ipsAccountLookup = lookup[0];
        let lookupSource = lookup[1];
  
        if (ipsAccountLookup) {
          // Calculate updated `tokenBalance`
          let tokenBalance = ipsAccountLookup.tokenBalance ?? undefined // If null, default to undefined
          let existingBalance = Number(bigintTransformer.to(tokenBalance));
          console.log(`\texisting balance: ${existingBalance}`);
          let remainingBalance = existingBalance - burn_amount;
          console.log(`\remaining balance: ${remainingBalance}`);
          console.log(`\tnew record?: NO`);
          console.log(`\tlookup source: ${lookupSource}`); 
          console.log(`\tipsObj: ${JSON.stringify(ipsAccountLookup.ips)}\n`);

          // If Account has no tokens associated with the IP set left, delete their IpsAccount record for this IP set
          if (remainingBalance <= 0) {
            await ctx.store.remove(IpsAccount, lookupId);
          }
          else {
            // Update tokenBalance
            ipsAccountLookup.tokenBalance = bigintTransformer.from(remainingBalance.toString());
            
            // If ipsAccount obj found in database, insert updated obj into events array
            if (lookupSource === "DATABASE") {
                events.ipsAccounts.push([ipsAccountLookup, toAccount]);
                events.accountIds.add(toAccount);
                console.log(`DATABASE SOURCE ADDEDED TO ipsAccounts ARRAY, events.ipsAccounts length: ${events.ipsAccounts.length}`);
                console.log(events.ipsAccounts);
            }
          }
        }
        // No record was found
        else {
          console.log(`\tnew record?: YES. This shouldn't happen. There is likely an issue with Minted or SubTokenCreated events.\n`);
        }
      }
  }
  