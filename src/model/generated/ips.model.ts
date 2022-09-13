import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import {IpsAccount} from "./ipsAccount.model"

@Entity_()
export class Ips {
  constructor(props?: Partial<Ips>) {
    Object.assign(this, props)
  }

  /**
   * IP set ID
   */
  @PrimaryColumn_()
  id!: string

  /**
   * Account ID of the IP set
   */
  @Column_("text", {nullable: false})
  accountId!: string

  @OneToMany_(() => IpsAccount, e => e.ips)
  accounts!: IpsAccount[]
}
