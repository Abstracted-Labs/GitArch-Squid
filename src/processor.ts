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

const placeholder_addr = "0x0000000000000000000000000000000000000000000000000000000000000000";

const ipsPlaceholderObj = new Ips({
  id: "0",
  accountId: placeholder_addr
});

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
  } as const);

type Item = BatchProcessorItem<typeof processor>;
type Ctx = BatchContext<Store, Item>;

processor.run(new TypeormDatabase(), async (ctx) => {
  const events = await getEvents(ctx);
  
  // Build map of accountId => Account, only for accountIds that have just been encountered
  let accounts = await ctx.store
    .findBy(Account, { id: In([...events.accountIds]) })
    .then((accounts) => {
      return new Map(accounts.map((a) => [a.id, a]));
    });

  let accountsTemp = await ctx.store
    .findBy(Account, { id: In([...events.accountIds]) })

    for (let account of accountsTemp) {
      console.log(`accounts: ${account}`);
    }

  for (const ipsAccount of events.ipsAccounts)  {
    let id = `${ipsAccount[0].id}`
    const account = getAccount(accounts, id, ipsAccount[1]);
    // necessary to add this field to the previously created model
    // because now we have the Account created.
    ipsAccount[0].account = account;
  }

  // Save 
  await ctx.store.save(Array.from(accounts.values()));
  await ctx.store.insert(events.ips.map(el => el[0]));
  await ctx.store.insert(events.ipsAccounts.map(el => el[0]));
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

type Tuple<T,K> = [T,K];
interface EventInfo {
  ips: Tuple<Ips, string>[];
  ipsAccounts: Tuple<IpsAccount, string>[];
  accountIds: Set<string>;
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

        console.log(`IPSCreated accountId: ${accountId}`);

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
          // let toAccount = ss58.codec(117).encode(token[1]);
          let toAccount = toHex(token[1]);
          let amount = Number(token[2]);

          console.log(`SubTokenCreated--ipsId: ${ipsId}`);
          console.log(`SubTokenCreated--toAccount: ${toAccount}`);
          console.log(`SubTokenCreated--amount: ${amount}`);

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
            let ipsAccountLookup = await getIpsAccountObj(ctx, events.ipsAccounts, ipsId.toString() + "-" + toAccount);

            if (ipsAccountLookup) {
              // Calculate updated `tokenBalance`
              let balance = 0;
              let tokenBalance = ipsAccountLookup.tokenBalance ?? undefined // If null, default to undefined
              let existingBalance = Number(bigintTransformer.to(tokenBalance));
              console.log(`SubTokenCreated--existingBalance: ${existingBalance}`);
              balance = existingBalance + amount;
              console.log(`SubTokenCreated--updatedBalance: ${balance}`);

              // Update tokenBalance
              ipsAccountLookup.tokenBalance = bigintTransformer.from(balance.toString());
            }
            // No record was found so create new
            else {
              let ips = await getIpsObj(ctx, events.ips, ipsId);

              // Create IpsAccount object
              ipsAccountLookup = new IpsAccount({
                id: ipsId.toString() + "-" + toAccount,
                account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
                ips: ips,
                tokenBalance: bigintTransformer.from(amount.toString())
              });
            }

            console.log(`ipsAccountLookup: ${ipsAccountLookup}`);            

            events.ipsAccounts.push([ipsAccountLookup, toAccount]);
            events.accountIds.add(toAccount);
          }
        }
      }

      // else if (item.name === "INV4.Minted") {
      //   const e = new Inv4SubTokenCreatedEvent(ctx, item.event);
        
      //   const subTokens = e.asV2.subTokensWithEndowment;
      //   for (let token of subTokens) {
      //     let ipsId = token[0][0];
      //     // let toAccount = ss58.codec(117).encode(token[1]);
      //     let toAccount = toHex(token[1]);
      //     let amount = Number(token[2]);

      //     console.log(`SubTokenCreated ipsId: "${ipsId}"`);
      //     console.log(`SubTokenCreated toAccount: ${toAccount}`);
      //     console.log(`SubTokenCreated amount: ${amount}`);

      //     // If 0 tokens are minted to an account then nothing changes
      //     // Only care if amount is > 0
      //     if (amount > 0) {
      //       let placeholder_acc = new Account({ id: placeholder_addr});

      //       let ipsObj = await ctx.store.get(Ips, ipsId.toString());

      //       console.log(`ipsObj: ${ipsObj}`);

      //       // temporary
      //       const ipsPlaceholderObj = new Ips({
      //         id: ipsId.toString(),
      //         accountId: placeholder_addr
      //       });

      //       // Create IpsAccount object
      //       const ipsAccountObj = new IpsAccount({
      //         id: ipsId.toString() + "-" + toAccount,
      //         account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
      //         ips: ipsPlaceholderObj
      //       });

      //       events.ipsAccounts.push([ipsAccountObj, toAccount]);
      //       events.accountIds.add(toAccount);
      //     }
      //   }
      // }

      // else if (item.name === "INV4.Minted") {
      //   const e = new Inv4MintedEvent(ctx, item.event);

      //   const { token, target, amount} = e.asV2;
      //   const accountId = target.toString();
      //   const ipsId = token.toString();

      //   // Create IpsAccount object
      //   const ipsAccountObj = new IpsAccount({
      //     id: ipsId.toString() + "-" + amount.toString(),
      //     account: new Account(), // Setting it here to something. Is updated in processor.run() with correect value
      //     ips: ipsObj
      //   });

      //   events.ipsAccounts.push([ipsAccountObj, accountId]);

      //   // add encountered account ID to the Set of unique accountIDs
      //   events.accountIds.add(accountId);
      // }
    }
  }
  return events;
}

function getAccount(m: Map<string, Account>, id: string, accountId: string): Account {
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

async function getIpsObj(ctx: Ctx, events: Tuple<Ips, string>[], ipsId: Number): Promise<Ips> {
  const defaultIpsObj = new Ips({
    id: ipsId.toString(),
    accountId: placeholder_addr
  });
  
  // First check buffered events
  let ipsObj = events.find(t => t[0].id === ipsId.toString())?.[0];

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
async function getIpsAccountObj(ctx: Ctx, events: Tuple<IpsAccount, string>[], ipsAccountId: string): Promise<IpsAccount | undefined> {
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