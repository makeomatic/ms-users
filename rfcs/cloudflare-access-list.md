# Cloudflare Access List

Provides an ability to manage Cloudflare IP list contents and controls TTL of the records.

## Why

In some cases, some groups of users should be able to access the service under any circumstances. So we should configure the Cloudflare firewall and provide rules that will allow us to skip some checks for some IP addresses.

Eg.: `If IP is in $some_list passthrough RateLimit checks`.

We can create a bunch of rules like: `IP.src in {127.0.0.1 127.0.1.1/24}`, but it's hard to manage, and there is an undocumented `4kb` length limit, so we won't be able to add not so many rules.

That's why we should use the `IP List` option.[https://blog.cloudflare.com/introducing-ip-lists/]

## Known limitations

  * We can have only a limited amount of the Firewall rules.
  * Only Firewall rules have `passthrough` action. IP Access Rules do not provide such an ability.
  * Each Ip List should contain a maximum of 1000 records, so this module provides the ability to use multiple lists.
  * Maximum list count depends on Cloudflare subscription.
  * Maximum firewall rule count depends on Cloudflare subscription.
  * Lists should already exist.
  * Maximum amount of API requests is 1200 in 5 minutes.

## General

* `CloudflareClient` - Auth configuration and additional response processing for Cloudflare API requests.

### CloudflareIpList

Handles IP and Ip List records registry and list synchronization.

On `addIp`:

1. Tries to get the list entries from Cloudflare and stores them in the cache.
2. Finds first free Ip List.
3. Adds IP address to the selected Ip List.
4. Adds record into Redis Hash that stores mapping between IP address and assigned list.
5. Increases cached list counters.

On `touchIp`:

1. Calls API like `addIp` and changes `updated_on` property of the record in IpList.

### CloudflareWorker

Only one instance should execute All synchronization tasks, so `@microfleet/plugin-consul` used.

Executes AccessList cleanup procedures every `n` seconds:

* Deletes outdated records from Ip Lists.
* Synchronizes remote IP Lists with local Redis IP -> IpList mappings.

### `cf.add-to-access-list` Action
```javascript
amqp.publishAndWait('cf.add-to-access-list', {
  remoteip: '10.1.1.1',
  comment: 'optional comment',
})
```

Action performs checks whether `remoteip` already in some lists. If IP does not exists calls `CloudflareIpList.addIP()` otherwise `CloudflareIpList.touchIp()`.

### Configuration

Please refer [schemas/config.json#/definitions/cfAccessList](../schemas/config.json) for information.

```javascript
module.exports = {
  cfAccessList: {
    enabled: true,
    auth: {
      serviceKey: 'valid-service-key'
    },
    accessList: {
      ttl: thirtyDays,
      listCacheTTL: fifteenMinutes,
    },
    worker: {
      enabled: true,
      concurrency: 5,
      cleanupInterval: halfAnHour,
    },
    api: {
      retry: {
        retries: 20,
        factor: 0.5,
      },
    },
  },
};

```
