⚡ **Example 10: Performance Patterns**

> Throughput testing, concurrent operations, and scaling patterns for Flashy systems.

## Scenarios

| Scenario | Pattern | Measurement |
|----------|---------|-------------|
| **Sequential** | One transfer after another | Baseline throughput |
| **Concurrent** | Parallel transfers | Throughput with async/await |
| **Queries** | 100 balance lookups | Query performance |
| **History** | Fetch audit trail | Log retrieval speed |
| **Large** | $10K transfer | Handling big amounts |
| **Memory** | Heap usage | Memory efficiency |

## Key Insights

1. **Concurrency:** Parallel operations are faster than sequential (async/await multiplexing)
2. **Queries:** Balance queries should be fast (< 10ms)
3. **Scaling:** System scales linearly with number of holders
4. **Memory:** In-memory store uses ~X MB for Y operations
5. **Large transfers:** System doesn't care about amount (all numbers are treated equally)

## Optimization Tips

- **Batch operations:** Group transfers into one operation when possible
- **Concurrent reads:** Query balances in parallel
- **Connection pooling:** Reuse database connections
- **Caching:** Cache balances only if acceptable staleness is fine (not for settlement!)
- **Async/await:** Use promises to parallelize I/O

## Production Scaling

For production deployments:
- Use MongoDB or Postgres (not in-memory)
- Configure connection pooling
- Monitor throughput and latency
- Set up alerting for anomalies
- Test with your actual workload

---

**All 10 examples complete.** See [flashy-examples/README.md](../README.md) for learning path.
