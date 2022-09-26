import {
  toHex,
} from "@subsquid/substrate-processor";
import {
  Account,
  IpsAccount
} from "../model/generated";
import {
  Inv4MintedEvent
} from "../types/events";
import { bigintTransformer } from "../model/generated/marshal";
import { placeholder_addr} from "../defaults";
import { EventInfo, getIpsAccountObj, getIpsObj} from "../utility";


export async function handleMinted(ctx: any, item: any, events: EventInfo) {
    const e = new Inv4MintedEvent(ctx, item.event);
        
    const {token, target, amount} = e.asV2;

    const ipsId = token[0];
    const subToken = token[1];
    const toAccount = toHex(target);
    const mint_amount = Number(bigintTransformer.to(amount));

    // If 0 tokens are minted to an account then nothing changes
    // Only care if amount is > 0
    if (mint_amount > 0) {
      console.log(`---Minted---\n\tipsId: ${ipsId}\n\tsub token: ${subToken}\n\ttoAccount: ${toAccount}\n\tamount created: ${mint_amount}`);

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
      let lookupId = ipsId.toString() + "-" + toAccount;
      let lookup = await getIpsAccountObj(ctx, events, lookupId, ipsId);
      let ipsAccountLookup = lookup[0];
      let lookupSource = lookup[1];

      if (ipsAccountLookup) {
        // Calculate updated `tokenBalance`
        let balance = 0;
        let tokenBalance = ipsAccountLookup.tokenBalance ?? undefined // If null, default to undefined
        let existingBalance = Number(bigintTransformer.to(tokenBalance));
        console.log(`\texisting balance: ${existingBalance}`);
        balance = existingBalance + mint_amount;
        console.log(`\tupdated balance: ${balance}`);
        console.log(`\tnew record?: NO`);
        console.log(`\tlookup source: ${lookupSource}`); 
        console.log(`\tipsObj: ${JSON.stringify(ipsAccountLookup.ips)}\n`); 

        // Update tokenBalance
        ipsAccountLookup.tokenBalance = bigintTransformer.from(balance.toString());

        // If ipsAccount obj found in database, insert updated obj into events array
        if (lookupSource === "DATABASE") {
          events.ipsAccounts.push([ipsAccountLookup, toAccount]);
          events.accountIds.add(toAccount);
          console.log(`DATABASE SOURCE ADDEDED TO ipsAccounts ARRAY, events.ipsAccounts length: ${events.ipsAccounts.length}`);
          console.log(events.ipsAccounts);
        }
      }
      // No record was found so create new
      else {
        console.log(`\tnew record?: YES\n`);

        let placeholder_acc = new Account({ id: placeholder_addr});
        let ips = await getIpsObj(ctx, events.ips, ipsId);

        // Create IpsAccount object
        ipsAccountLookup = new IpsAccount({
          id: ipsId.toString() + "-" + toAccount,
          account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
          ips: ips,
          tokenBalance: amount
        });

        events.ipsAccounts.push([ipsAccountLookup, toAccount]);
        events.accountIds.add(toAccount);
      }
    }
}
