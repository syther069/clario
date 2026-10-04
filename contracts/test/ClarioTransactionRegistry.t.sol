// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ClarioTransactionRegistry } from "../src/ClarioTransactionRegistry.sol";

contract ClarioTransactionRegistryTest {
    ClarioTransactionRegistry private registry;

    address private constant ALICE = address(0x1111111111111111111111111111111111111111);
    address private constant BOB = address(0x2222222222222222222222222222222222222222);

    bytes32 private constant TX_ID_1 = keccak256("tx-uuid-1");
    bytes32 private constant TX_ID_2 = keccak256("tx-uuid-2");
    bytes32 private constant DATA_HASH_1 = keccak256("canonical-tx-data-1");
    bytes32 private constant DATA_HASH_2 = keccak256("canonical-tx-data-2");

    bytes32 private constant RECEIPT_ID_1 = keccak256("receipt-uuid-1");
    bytes32 private constant RECEIPT_ID_2 = keccak256("receipt-uuid-2");
    bytes32 private constant RECEIPT_HASH_1 = keccak256("canonical-receipt-data-1");
    bytes32 private constant RECEIPT_HASH_2 = keccak256("canonical-receipt-data-2");

    event TransactionSaved(
        address indexed user, bytes32 indexed transactionId, bytes32 dataHash, uint256 timestamp
    );

    event ReceiptSaved(
        address indexed owner,
        bytes32 indexed receiptId,
        bytes32 receiptHash,
        uint256 transactionCount,
        uint256 timestamp
    );

    function setUp() public {
        registry = new ClarioTransactionRegistry();
    }

    // 1. Save Transaction & Hash Integrity
    function testSaveTransactionAndHashIntegrity() public {
        registry.saveTransaction(TX_ID_1, DATA_HASH_1);

        assert(registry.getTransactionCount(address(this)) == 1);

        ClarioTransactionRegistry.SavedTransaction memory saved =
            registry.getTransaction(address(this), TX_ID_1);

        assert(saved.transactionId == TX_ID_1);
        assert(saved.dataHash == DATA_HASH_1);
        assert(saved.user == address(this));
        assert(saved.timestamp > 0);
    }

    // 2. User Isolation
    function testUserIsolation() public {
        // Save as current contract
        registry.saveTransaction(TX_ID_1, DATA_HASH_1);

        // ALICE should have 0 records
        assert(registry.getTransactionCount(ALICE) == 0);
        ClarioTransactionRegistry.SavedTransaction[] memory aliceTxs =
            registry.getTransactions(ALICE);
        assert(aliceTxs.length == 0);

        // BOB should have 0 records
        assert(registry.getTransactionCount(BOB) == 0);
    }

    // 3. Multiple Transactions Per User
    function testMultipleTransactionsPerUser() public {
        registry.saveTransaction(TX_ID_1, DATA_HASH_1);
        registry.saveTransaction(TX_ID_2, DATA_HASH_2);

        assert(registry.getTransactionCount(address(this)) == 2);

        ClarioTransactionRegistry.SavedTransaction[] memory txs =
            registry.getTransactions(address(this));
        assert(txs.length == 2);
        assert(txs[0].transactionId == TX_ID_1);
        assert(txs[0].dataHash == DATA_HASH_1);
        assert(txs[1].transactionId == TX_ID_2);
        assert(txs[1].dataHash == DATA_HASH_2);
    }

    // 4. Invalid Input Reversions
    function testCannotSaveZeroTransactionId() public {
        try registry.saveTransaction(bytes32(0), DATA_HASH_1) {
            revert("Expected revert on zero transactionId");
        } catch { }
    }

    function testCannotSaveZeroDataHash() public {
        try registry.saveTransaction(TX_ID_1, bytes32(0)) {
            revert("Expected revert on zero dataHash");
        } catch { }
    }

    // 5. Duplicate Transaction Id Reversion
    function testCannotSaveDuplicateTransactionId() public {
        registry.saveTransaction(TX_ID_1, DATA_HASH_1);

        try registry.saveTransaction(TX_ID_1, DATA_HASH_2) {
            revert("Expected revert on duplicate transactionId");
        } catch { }
    }

    // 6. Transaction Not Found Reversion
    function testGetNonExistentTransactionReverts() public view {
        try registry.getTransaction(address(this), keccak256("non-existent")) {
            revert("Expected revert on non-existent transaction");
        } catch { }
    }

    // 7. Save Receipt Bundle & Hash Integrity
    function testSaveReceiptAndHashIntegrity() public {
        registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 3);

        assert(registry.getReceiptCount(address(this)) == 1);

        ClarioTransactionRegistry.Receipt memory saved =
            registry.getReceipt(address(this), RECEIPT_ID_1);

        assert(saved.receiptId == RECEIPT_ID_1);
        assert(saved.receiptHash == RECEIPT_HASH_1);
        assert(saved.transactionCount == 3);
        assert(saved.owner == address(this));
        assert(saved.timestamp > 0);
    }

    // 8. Receipt User Isolation
    function testReceiptUserIsolation() public {
        registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 5);

        assert(registry.getReceiptCount(ALICE) == 0);
        ClarioTransactionRegistry.Receipt[] memory aliceReceipts = registry.getReceipts(ALICE);
        assert(aliceReceipts.length == 0);
    }

    // 9. Multiple Receipt Bundles Per User
    function testMultipleReceiptBundlesPerUser() public {
        registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 2);
        registry.saveReceipt(RECEIPT_ID_2, RECEIPT_HASH_2, 4);

        assert(registry.getReceiptCount(address(this)) == 2);

        ClarioTransactionRegistry.Receipt[] memory receipts = registry.getReceipts(address(this));
        assert(receipts.length == 2);
        assert(receipts[0].receiptId == RECEIPT_ID_1);
        assert(receipts[0].transactionCount == 2);
        assert(receipts[1].receiptId == RECEIPT_ID_2);
        assert(receipts[1].transactionCount == 4);
    }

    // 10. Invalid Receipt Inputs Reversion
    function testCannotSaveZeroReceiptId() public {
        try registry.saveReceipt(bytes32(0), RECEIPT_HASH_1, 2) {
            revert("Expected revert on zero receiptId");
        } catch { }
    }

    function testCannotSaveZeroReceiptHash() public {
        try registry.saveReceipt(RECEIPT_ID_1, bytes32(0), 2) {
            revert("Expected revert on zero receiptHash");
        } catch { }
    }

    function testCannotSaveZeroTransactionCount() public {
        try registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 0) {
            revert("Expected revert on zero transactionCount");
        } catch { }
    }

    // 11. Duplicate Receipt Id Reversion
    function testCannotSaveDuplicateReceiptId() public {
        registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 2);

        try registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_2, 3) {
            revert("Expected revert on duplicate receiptId");
        } catch { }
    }

    // 12. Non-existent Receipt Reversion
    function testGetNonExistentReceiptReverts() public view {
        try registry.getReceipt(address(this), keccak256("non-existent-receipt")) {
            revert("Expected revert on non-existent receipt");
        } catch { }
    }

    // 13. Combined Transactions and Receipt Bundles
    function testCombinedTransactionsAndReceipts() public {
        registry.saveTransaction(TX_ID_1, DATA_HASH_1);
        registry.saveReceipt(RECEIPT_ID_1, RECEIPT_HASH_1, 1);

        assert(registry.getTransactionCount(address(this)) == 1);
        assert(registry.getReceiptCount(address(this)) == 1);

        ClarioTransactionRegistry.SavedTransaction memory txRecord =
            registry.getTransaction(address(this), TX_ID_1);
        ClarioTransactionRegistry.Receipt memory receiptRecord =
            registry.getReceipt(address(this), RECEIPT_ID_1);

        assert(txRecord.transactionId == TX_ID_1);
        assert(receiptRecord.receiptId == RECEIPT_ID_1);
    }

    // 14. Paginated Transactions Retrieval
    function testPaginatedTransactions() public {
        bytes32 id1 = keccak256("page-tx-1");
        bytes32 id2 = keccak256("page-tx-2");
        bytes32 id3 = keccak256("page-tx-3");

        registry.saveTransaction(id1, keccak256("hash-1"));
        registry.saveTransaction(id2, keccak256("hash-2"));
        registry.saveTransaction(id3, keccak256("hash-3"));

        (ClarioTransactionRegistry.SavedTransaction[] memory page1, uint256 total1) =
            registry.getTransactionsPaginated(address(this), 0, 2);
        assert(total1 == 3);
        assert(page1.length == 2);
        assert(page1[0].transactionId == id1);
        assert(page1[1].transactionId == id2);

        (ClarioTransactionRegistry.SavedTransaction[] memory page2, uint256 total2) =
            registry.getTransactionsPaginated(address(this), 2, 2);
        assert(total2 == 3);
        assert(page2.length == 1);
        assert(page2[0].transactionId == id3);

        (ClarioTransactionRegistry.SavedTransaction[] memory pageEmpty, uint256 totalEmpty) =
            registry.getTransactionsPaginated(address(this), 5, 2);
        assert(totalEmpty == 3);
        assert(pageEmpty.length == 0);
    }

    // 15. Paginated Receipts Retrieval
    function testPaginatedReceipts() public {
        bytes32 r1 = keccak256("page-r-1");
        bytes32 r2 = keccak256("page-r-2");
        bytes32 r3 = keccak256("page-r-3");

        registry.saveReceipt(r1, keccak256("rhash-1"), 1);
        registry.saveReceipt(r2, keccak256("rhash-2"), 2);
        registry.saveReceipt(r3, keccak256("rhash-3"), 3);

        (ClarioTransactionRegistry.Receipt[] memory page1, uint256 total1) =
            registry.getReceiptsPaginated(address(this), 0, 2);
        assert(total1 == 3);
        assert(page1.length == 2);
        assert(page1[0].receiptId == r1);
        assert(page1[1].receiptId == r2);

        (ClarioTransactionRegistry.Receipt[] memory page2, uint256 total2) =
            registry.getReceiptsPaginated(address(this), 2, 2);
        assert(total2 == 3);
        assert(page2.length == 1);
        assert(page2[0].receiptId == r3);

        (ClarioTransactionRegistry.Receipt[] memory pageEmpty, uint256 totalEmpty) =
            registry.getReceiptsPaginated(address(this), 10, 5);
        assert(totalEmpty == 3);
        assert(pageEmpty.length == 0);
    }
}

