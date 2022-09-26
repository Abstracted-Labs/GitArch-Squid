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
  Inv4IpsCreatedEvent, Inv4SubTokenCreatedEvent
} from "./types/events";
import { bigintTransformer } from "./model/generated/marshal";
import { handleMinted, handleBurned } from "./handlers";
import { placeholder_addr, ipsPlaceholderObj} from "./defaults";
import { EventInfo, getAccount, getIpsAccountObj, getIpsObj} from "./utility";


const processor = new SubstrateBatchProcessor()
  .setBatchSize(500)
  .setDataSource({
    archive: lookupArchive("invarch-tinkernet", { release: "FireSquid" }),
  })
  .setBlockRange({ from: 1 })
  .addEvent("INV4.IPSCreated", {
    data: { event: { args: true , extrinsic: true, call: true} },
  } as const)
  .addEvent("INV4.SubTokenCreated", {
    data: { event: { args: true , extrinsic: true, call: true} },
  } as const)
  .addEvent("INV4.Minted", {
    data: { event: { args: true , extrinsic: true, call: true} },
  } as const)
  .addEvent("INV4.Burned", {
    data: { event: { args: true , extrinsic: true, call: true} },
  } as const);

type Item = BatchProcessorItem<typeof processor>;
type Ctx = BatchContext<Store, Item>;

processor.run(new TypeormDatabase(), async (ctx) => {
  const events = await getEvents(ctx);
  
  // Build map of accountId => Account, only for accountIds that have just been encountered
  let accounts = await ctx.store
    .findBy(Account, { accountId: In([...events.accountIds]) })
    .then((accounts) => {
      return new Map(accounts.map((a) => [a.accountId, a]));
    });

  let accountsTemp = await ctx.store
    .findBy(Account, { accountId: In([...events.accountIds]) })

    for (let account of accountsTemp) {
      console.log(`accounts: ${JSON.stringify(account)}`);
    }

  console.log(`\n-------PROCESSOR.RUN()--------ipsAccounts length: ${events.ipsAccounts.length}`);
  for (const ipsAccount of events.ipsAccounts)  {
    let id = `${ipsAccount[0].id}`
    const account = getAccount(accounts, ipsAccount[1]);
    // necessary to add this field to the previously created model
    // because now we have the Account created.
    ipsAccount[0].account = account;

    let ips = JSON.stringify(ipsAccount[0].ips);
    console.log(ips);
    
    let acc = JSON.stringify(ipsAccount[0].account);
    console.log(acc);

    let tokenBalance = ipsAccount[0].tokenBalance ?? undefined // If null, default to undefined
    let bal = Number(bigintTransformer.to(tokenBalance));
    console.log(bal);

    console.log();
  }

  // Save 
  await ctx.store.save(Array.from(accounts.values()));
  await ctx.store.insert(events.ips.map(el => el[0]));
  // await ctx.store.insert(events.ipsAccounts.map(el => el[0]));
  await ctx.store.save(events.ipsAccounts.map(el => el[0]));
});

function stringifyArray(list: any[]): any[] {
  let listStr: any[] = [];
  for (let vec of list) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] = String(vec[i]);
    }
    listStr.push(vec);
  }
  return listStr;
}

async function getEvents(ctx: Ctx): Promise<EventInfo> {
  let events: EventInfo = {
    ips: [],
    ipsAccounts: [],
    accountIds: new Set<string>(),
  };
  for (let block of ctx.blocks) {
    for (let item of block.items) {
      if (item.name === "INV4.IPSCreated") {
        const e = new Inv4IpsCreatedEvent(ctx, item.event);

        const accountId = item.event.call?.origin?.value.value;
        const { ipsAccount, ipsId, assets } = e.asV2;
        const encodedIpsAccount = ss58.codec(117).encode(ipsAccount);

        console.log(`---IPSCreated---\n\tipsId: ${ipsId}\n\tcreator account ID: ${accountId}\n\tIPS account ID: ${encodedIpsAccount}\n`);

        // Create Ips object
        const ipsObj = new Ips({
          id: ipsId.toString(),
          accountId: encodedIpsAccount
        });

        events.ips.push([ipsObj, accountId]);

        let placeholder_acc = new Account({ id: encodedIpsAccount});

        // Create IpsAccount object
        const ipsAccountObj = new IpsAccount({
          id: ipsId.toString() + "-" + accountId.toString(),
          account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
          ips: ipsObj,
          tokenBalance: bigintTransformer.from(String(1_000_000)) // Default IPT0 token balance for new IPS
        });

        events.ipsAccounts.push([ipsAccountObj, accountId]);

        // events.ips.push([new Ips({
        //   id: item.event.id,
        //   fileCid: toHex(e.asV1[1]),
        //   blockHash: block.header.hash,
        //   blockNum: block.header.height,
        //   createdAt: new Date(block.header.timestamp),
        //   extrinsicId: item.event.extrinsic?.id,
        // }), accountId]);

        // add encountered account ID to the Set of unique accountIDs
        events.accountIds.add(accountId);
      }

      else if (item.name === "INV4.SubTokenCreated") {
        const e = new Inv4SubTokenCreatedEvent(ctx, item.event);
        
        const subTokens = e.asV2.subTokensWithEndowment;
        for (let token of subTokens) {
          let ipsId = token[0][0];
          let subToken = token[0][1];
          // let toAccount = ss58.codec(117).encode(token[1]);
          let toAccount = toHex(token[1]);
          let amount = Number(token[2]);

          console.log(`---SubTokenCreated---\n\tipsId: ${ipsId}\n\tsub token: ${subToken}\n\tto account: ${toAccount}\n\tamount created: ${amount}`);

          // If 0 tokens are minted to an account then nothing changes
          // Only care if amount is > 0
          if (amount > 0) {
            let placeholder_acc = new Account({ id: placeholder_addr});

            /* 
            1. Check if a record already exists for that IPS-accountId pair
            2. If record exists, then 
                - get IpsAccount object
                - remove record from DB
                - update IpsAccount.tokenBalance in object
            3. If record does not exist, then
                - create new IpsAccount object
                - set IpsAccount.tokenBalance = amount
                - push object to events
            */
            let lookup = await getIpsAccountObj(ctx, events, ipsId.toString() + "-" + toAccount, ipsId);
            let ipsAccountLookup = lookup[0];
            let lookupSource = lookup[1];

            if (ipsAccountLookup) {
              // Calculate updated `tokenBalance`
              let balance = 0;
              let tokenBalance = ipsAccountLookup.tokenBalance ?? undefined // If null, default to undefined
              let existingBalance = Number(bigintTransformer.to(tokenBalance));
              console.log(`\texisting balance: ${existingBalance}`);
              balance = existingBalance + amount;
              console.log(`\tupdated balance: ${balance}`);
              console.log(`\tnew record?: NO`);
              console.log(`\tipsAccountLookup: ${ipsAccountLookup}\n`); 

              // Update tokenBalance
              ipsAccountLookup.tokenBalance = bigintTransformer.from(balance.toString());

               // If ipsAccount obj found in database, insert updated obj into events array
              if (lookupSource === "DATABASE") {
                events.ipsAccounts.push([ipsAccountLookup, toAccount]);
                events.accountIds.add(toAccount);
              }
            }
            // No record was found so create new
            else {
              console.log(`\tnew record?: YES\n`);

              let ips = await getIpsObj(ctx, events.ips, ipsId);

              // Create IpsAccount object
              ipsAccountLookup = new IpsAccount({
                id: ipsId.toString() + "-" + toAccount,
                account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
                ips: ips,
                tokenBalance: bigintTransformer.from(amount.toString())
              });

              events.ipsAccounts.push([ipsAccountLookup, toAccount]);
              events.accountIds.add(toAccount);
            }      

            console.log(events.ipsAccounts);
          }
        }
      }

      else if (item.name === "INV4.Minted") {
        await handleMinted(ctx, item, events);

        console.log(events.ipsAccounts);
      }

      else if (item.name === "INV4.Burned") {
        await handleBurned(ctx, item, events);
      }
    }
  }
  return events;
}

